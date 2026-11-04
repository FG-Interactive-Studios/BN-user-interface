"""Headless, offline verification of the PR launcher."""
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

SRC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC))
import core


class FakeResponse(io.BytesIO):
    status = 200


def fake_opener(request, timeout):
    assert timeout == 15
    assert request.full_url.startswith("https://api.github.com/repos/FG-Interactive-Studios/")
    page = int(request.full_url.split("page=")[-1])
    if page == 1:
        return FakeResponse(json.dumps([
            {"number": 5, "title": "Figma: front", "user": {"login": "dev"},
             "draft": True, "head": {"repo": {"full_name": core.REPOSITORIES["front"]}}},
            {"number": 12, "title": "Outra branch", "user": {"login": "forker"},
             "draft": False, "head": {"repo": {"full_name": "fork/user-interface"}}}
        ]).encode())
    return FakeResponse(b"[]")


class GithubTests(unittest.TestCase):
    def test_dynamic_versions_without_hardcoded_numbers(self):
        items = core.github_versions(core.REPOSITORIES["front"], fake_opener)
        self.assertEqual([item.kind for item in items], ["main", "pr", "pr"])
        self.assertEqual(items[1].number, 5)
        self.assertTrue(items[1].draft)
        self.assertFalse(items[1].from_fork)
        self.assertTrue(items[2].from_fork)
        self.assertEqual(items[1].ref, "refs/pull/5/head")
        self.assertEqual(items[0].ref, "refs/heads/main")

    def test_reject_unapproved_repo(self):
        with self.assertRaises(core.LauncherError):
            core.github_versions("random/unsafe", fake_opener)

    def test_invalid_pr_reference(self):
        with self.assertRaises(core.LauncherError):
            _ = core.Version(core.REPOSITORIES["front"], "pr", -1).ref

    def test_repo_version_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = core.Engine(Path(tmp), lambda _: None)
            with self.assertRaises(core.LauncherError):
                runner.version_directory("api", core.main_version(core.REPOSITORIES["front"]))


@unittest.skipUnless(shutil.which("git"), "Git not installed")
class GitIsolationTests(unittest.TestCase):
    @staticmethod
    def git(cwd, *args):
        return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()

    def test_main_and_pr_worktrees_from_local_fake_github(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source"
            source.mkdir()
            self.git(source, "init", "-b", "main")
            self.git(source, "config", "user.email", "tester@example.test")
            self.git(source, "config", "user.name", "Tester")
            (source / "file.txt").write_text("main")
            self.git(source, "add", ".")
            self.git(source, "commit", "-m", "main")
            main_sha = self.git(source, "rev-parse", "HEAD")
            self.git(source, "checkout", "-b", "feature/ui")
            (source / "file.txt").write_text("pr")
            self.git(source, "commit", "-am", "pr")
            pr_sha = self.git(source, "rev-parse", "HEAD")
            bare_origin = root / "remote.git"
            self.git(root, "clone", "--bare", str(source), str(bare_origin))
            self.git(source, "remote", "add", "origin", str(bare_origin))
            self.git(source, "push", "origin", f"{main_sha}:refs/heads/main")
            self.git(source, "push", "origin", f"{pr_sha}:refs/pull/44/head")
            app = core.Engine(root / "app", lambda _: None)
            real_command = app.command
            def local_clone(args, cwd, label, timeout=240):
                if len(args) > 3 and args[1:3] == ["clone", "--bare"]:
                    args = list(args)
                    args[3] = str(bare_origin)
                return real_command(args, cwd, label, timeout)
            app.command = local_clone
            front_repo = core.REPOSITORIES["front"]
            main_path = app.version_directory("front", core.main_version(front_repo))
            pr_path = app.version_directory("front", core.Version(front_repo, "pr", 44))
            self.assertEqual((main_path / "file.txt").read_text(), "main")
            self.assertEqual((pr_path / "file.txt").read_text(), "pr")
            self.assertNotEqual(main_path, pr_path)
            self.assertEqual(app.version_directory("front", core.Version(front_repo, "pr", 44)), pr_path)
            self.assertEqual(self.git(source, "rev-parse", "HEAD"), pr_sha)


class ProcessSafetyTests(unittest.TestCase):
    def test_no_erase_or_reset_commands(self):
        script = (SRC / "core.py").read_text()
        self.assertNotIn("reset --hard", script)
        self.assertNotIn("down -v", script)
        self.assertNotIn("volume rm", script)
        self.assertIn('"compose", "up", "-d"', script)

    def test_detect_existing_frontend_before_start(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = core.Engine(Path(tmp), lambda _: None)
            with patch.object(app, "node_check", return_value="npm"), \
                 patch.object(core, "port_busy", return_value=True):
                with self.assertRaisesRegex(core.LauncherError, "5173"):
                    app.launch(Path(tmp), Path(tmp), docker=False, reuse_api=True)



class DockerStartupTests(unittest.TestCase):
    def test_engine_probe_returns_linux(self):
        result = SimpleNamespace(returncode=0, stdout="linux\n", stderr="")
        with patch.object(core.subprocess, "run", return_value=result) as probe:
            self.assertEqual(core.Engine.docker_engine_mode("docker"), "linux")
        self.assertEqual(probe.call_args.args[0], ["docker", "info", "--format", "{{.OSType}}"])

    def test_engine_probe_gracefully_handles_missing_pipe(self):
        result = SimpleNamespace(returncode=1, stdout="", stderr="dockerDesktopLinuxEngine not found")
        with patch.object(core.subprocess, "run", return_value=result):
            self.assertIsNone(core.Engine.docker_engine_mode("docker"))

    def test_running_engine_skips_desktop_startup(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = core.Engine(Path(tmp), lambda _: None)
            with patch.object(runner, "docker_engine_mode", return_value="linux"), \
                 patch.object(runner, "docker_desktop_executable") as desktop:
                runner.ensure_docker_engine("docker")
                desktop.assert_not_called()

    def test_windows_containers_requires_switch(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = core.Engine(Path(tmp), lambda _: None)
            with patch.object(runner, "docker_engine_mode", return_value="windows"):
                with self.assertRaisesRegex(core.LauncherError, "Linux containers"):
                    runner.ensure_docker_engine("docker")

    def test_stopped_docker_desktop_autostarts_and_waits_for_linux(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = []
            runner = core.Engine(Path(tmp), log.append)
            desktop = Path("Docker Desktop.exe")
            with patch.object(core, "os", SimpleNamespace(name="nt")), \
                 patch.object(runner, "docker_engine_mode", side_effect=[None, None, "linux"]), \
                 patch.object(runner, "docker_desktop_executable", return_value=desktop), \
                 patch.object(core.subprocess, "Popen") as start, \
                 patch.object(core.time, "sleep"):
                runner.ensure_docker_engine("docker")
            start.assert_called_once()
            self.assertEqual(start.call_args.args[0], [str(desktop)])
            self.assertTrue(any("pronto" in message.lower() for message in log))

    def test_windows_missing_desktop_shows_actionable_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = core.Engine(Path(tmp), lambda _: None)
            with patch.object(core, "os", SimpleNamespace(name="nt")), \
                 patch.object(runner, "docker_engine_mode", return_value=None), \
                 patch.object(runner, "docker_desktop_executable", return_value=None):
                with self.assertRaisesRegex(core.LauncherError, "Abra o Docker Desktop"):
                    runner.ensure_docker_engine("docker")

if __name__ == "__main__":
    unittest.main()