import { readFileSync } from "fs"
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const axios = require("axios")

const TOKEN = "glpat-DuSYGfrebh1DqZYyy5Q5eW86MQp1OmRxbDdxCw.01.120j7wput"
const PROJECT = "79558990"

const api = axios.create({
  baseURL: "https://gitlab.com/api/v4",
  headers: { "PRIVATE-TOKEN": TOKEN },
})

const { data } = await api.post(`/projects/${PROJECT}/repository/commits`, {
  branch: "main",
  commit_message: "fix: update RCA prompt to use $AI_FLOW_CONTEXT/$AI_FLOW_INPUT and never ask for clarification",
  actions: [
    {
      action: "update",
      file_path: "flows/devflow.yml",
      content: readFileSync("flows/devflow.yml", "utf8"),
    },
  ],
})
console.log("✅ Pushed:", data.id)
console.log("   URL:", data.web_url)
