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


class ExistingPostgresContainerTests(unittest.TestCase):
    @staticmethod
    def compatible(running=True):
        return {
            "Config": {
                "Image": "postgres:17",
                "Env": [
                    "POSTGRES_DB=battleship", "POSTGRES_USER=postgres",
                    "POSTGRES_PASSWORD=not-written-to-logs",
                ],
            },
            "HostConfig": {"PortBindings": {"5432/tcp": [
                {"HostIp": "0.0.0.0", "HostPort": "5432"}
            ]}},
            "State": {"Running": running},
        }

    def test_inspect_existing_named_container(self):
        response = SimpleNamespace(
            returncode=0, stdout=json.dumps([self.compatible()]), stderr=""
        )
        with patch.object(core.subprocess, "run", return_value=response) as run:
            result = core.Engine.inspect_existing_postgres("docker")
        self.assertEqual(result["Config"]["Image"], "postgres:17")
        self.assertEqual(
            run.call_args.args[0],
            ["docker", "container", "inspect", "batalha-naval-postgres"],
        )

    def test_missing_named_container_is_not_an_error(self):
        response = SimpleNamespace(returncode=1, stdout="",
                                   stderr="Error: No such object: batalha-naval-postgres")
        with patch.object(core.subprocess, "run", return_value=response):
            self.assertIsNone(core.Engine.inspect_existing_postgres("docker"))

    def test_reuse_running_container_without_compose(self):
        with tempfile.TemporaryDirectory() as tmp:
            engine = core.Engine(Path(tmp), lambda _: None)
            with patch.object(engine, "inspect_existing_postgres", return_value=self.compatible()), \
                 patch.object(engine, "command") as command, \
                 patch.object(engine, "wait") as wait:
                engine.start_postgres("docker", Path(tmp))
            command.assert_not_called()
            wait.assert_called_once()
            self.assertEqual(wait.call_args.args[2], "PostgreSQL existente")

    def test_start_stopped_container_without_recreating_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            engine = core.Engine(Path(tmp), lambda _: None)
            with patch.object(engine, "inspect_existing_postgres",
                              return_value=self.compatible(running=False)), \
                 patch.object(engine, "command") as command, \
                 patch.object(engine, "wait"):
                engine.start_postgres("docker", Path(tmp))
            self.assertEqual(
                command.call_args.args[0],
                ["docker", "start", "batalha-naval-postgres"],
            )

    def test_empty_environment_uses_compose(self):
        with tempfile.TemporaryDirectory() as tmp:
            engine = core.Engine(Path(tmp), lambda _: None)
            with patch.object(engine, "inspect_existing_postgres", return_value=None), \
                 patch.object(engine, "command") as command, \
                 patch.object(engine, "wait"):
                engine.start_postgres("docker", Path(tmp))
            self.assertEqual(command.call_args.args[0], ["docker", "compose", "up", "-d"])

    def test_incompatible_existing_container_is_never_modified(self):
        with tempfile.TemporaryDirectory() as tmp:
            engine = core.Engine(Path(tmp), lambda _: None)
            mismatched = self.compatible()
            mismatched["Config"]["Image"] = "mysql:8"
            with patch.object(engine, "inspect_existing_postgres", return_value=mismatched), \
                 patch.object(engine, "command") as command:
                with self.assertRaisesRegex(core.LauncherError, "não corresponde"):
                    engine.start_postgres("docker", Path(tmp))
            command.assert_not_called()

    def test_wrong_host_port_is_not_reused(self):
        info = self.compatible()
        info["HostConfig"]["PortBindings"]["5432/tcp"][0]["HostPort"] = "5433"
        with self.assertRaises(core.LauncherError):
            core.Engine.check_existing_postgres_compatibility(info)

    def test_sql_readiness_checks_correct_database(self):
        result = SimpleNamespace(returncode=0, stdout="1\n", stderr="")
        with patch.object(core.subprocess, "run", return_value=result) as command:
            ok = core.Engine.postgres_ready("docker", Path("."), container_name="batalha-naval-postgres")
        self.assertTrue(ok)
        self.assertEqual(
            command.call_args.args[0],
            ["docker", "exec", "batalha-naval-postgres", "psql",
             "-U", "postgres", "-d", "battleship", "-Atqc", "SELECT 1"],
        )

    def test_sql_readiness_rejects_missing_database(self):
        response = SimpleNamespace(returncode=2, stdout="", stderr="database battleship does not exist")
        with patch.object(core.subprocess, "run", return_value=response):
            self.assertFalse(core.Engine.postgres_ready(
                "docker", Path("."), container_name="batalha-naval-postgres"
            ))



@unittest.skipUnless(sys.platform == "win32", "Requires real Windows CMD execution")
class WindowsBatchPathTests(unittest.TestCase):
    """Regression: batch wrappers must execute with spaces in the checkout path."""

    def test_maven_wrapper_with_spaces_in_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            checkout = Path(tmp) / "FG Interactive" / "BN-alt" / "versions" / "api" / "main-test"
            checkout.mkdir(parents=True)
            wrapper = checkout / "mvnw.cmd"
            wrapper.write_bytes(
                b"@echo off\r\necho BN_API_OK:%~1:%~2\r\n"
            )
            proc = core.Engine.spawn(
                [str(wrapper), "spring-boot:run", "-Dspring-boot.run.profiles=local"],
                checkout,
            )
            try:
                stdout, _ = proc.communicate(timeout=15)
            finally:
                core.terminate_tree(proc)
            self.assertEqual(proc.returncode, 0, stdout)
            self.assertIn("BN_API_OK:spring-boot:run:-Dspring-boot.run.profiles=local", stdout)

    def test_npm_batch_wrapper_with_spaces_in_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            checkout = Path(tmp) / "FG Interactive" / "BN-alt" / "versions" / "front" / "pr-5-test"
            checkout.mkdir(parents=True)
            wrapper = checkout / "npm.cmd"
            wrapper.write_bytes(
                b"@echo off\r\necho BN_FRONT_OK:%~1:%~2\r\n"
            )
            proc = core.Engine.spawn(
                [str(wrapper), "run", "dev"],
                checkout,
            )
            try:
                stdout, _ = proc.communicate(timeout=15)
            finally:
                core.terminate_tree(proc)
            self.assertEqual(proc.returncode, 0, stdout)
            self.assertIn("BN_FRONT_OK:run:dev", stdout)

    def test_spawn_does_not_double_escape_batch_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            checkout = Path(tmp) / "FG Interactive"
            checkout.mkdir()
            wrapper = checkout / "mvnw.cmd"
            wrapper.write_bytes(b"@echo off\r\necho EXECUTED\r\n")
            with patch.object(core.subprocess, "Popen") as popen:
                core.Engine.spawn([str(wrapper), "spring-boot:run"], checkout)
            self.assertEqual(
                popen.call_args.args[0],
                [str(wrapper), "spring-boot:run"],
            )
            self.assertEqual(popen.call_args.kwargs.get("cwd"), str(checkout))

if __name__ == "__main__":
    unittest.main()