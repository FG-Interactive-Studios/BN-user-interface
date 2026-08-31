import { api } from "../services/api";

interface HealthResponse {
  status: string;
}

async function checkHealth() {
  const health = await api<HealthResponse>("/health");
  console.log(health.status);
  return health;
}

void checkHealth();

export { checkHealth };
