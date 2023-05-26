#!/usr/bin/env node

import fs from "fs/promises";
import readline from "readline/promises";

const TOKEN = process.env.GTOKEN;

if (TOKEN === undefined) {
  console.log(
    "Github token not found. Please set GTOKEN env variable and export it."
  );
  process.exit(1);
}

const BASE_URL = "https://api.github.com/";

// const ORG = "the-demo-org";
// const USER = "prateekpandey2022apr-cedcoss";
// const SINCE = "";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ORG = await rl.question("Enter org: ");
const USER = await rl.question("Enter username: ");
const SINCE = await rl.question(
  "Enter since (optional: YYYY-MM-DDTHH:MM:SSZ) : "
);

rl.close();

const start = Date.now();

async function* getOrgRepos(org) {
  let perPage = 4;
  let page = 1;
  let data = [];

  while (true) {
    console.log(`Fetching repos page: ${page}`);

    const res = await fetch(
      `${BASE_URL}orgs/${org}/repos?per_page=${perPage}&page=${page}`,
      {
        method: "GET",
        headers: {
          Authorization: `token ${TOKEN}`,
        },
      }
    );

    page++;

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    data = await res.json();

    if (data.length === 0) {
      break;
    }

    yield data;
  }
}

async function* getCommits(org, repo) {
  let perPage = 4;
  let page = 1;
  let data = [];

  const url = new URL(`${BASE_URL}repos/${org}/${repo}/commits`);

  if (SINCE) {
    url.searchParams.set("since", new Date(SINCE).toISOString());
  }

  while (true) {
    url.searchParams.set("per_page", perPage);
    url.searchParams.set("page", page);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `token ${TOKEN}`,
      },
    });

    page++;

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    data = await res.json();

    if (data.length === 0) {
      break;
    }

    yield data;
  }
}

function logError(message) {
  console.log(`\x1b[31m${message} \x1b[0m`);
}

function logSuccess(message) {
  console.log(`\x1b[32m${message} \x1b[0m`);
}

let repos = [];
let orgResponse = [];

// to stire the mapping of repo and the commits
const commitInfo = new Map();

try {
  for await (const data of getOrgRepos(ORG)) {
    // console.log(data);
    orgResponse.push(...data);
  }
} catch (error) {
  console.log(error.message);
  console.log(`Error: Unable to fetch repos from ${ORG}`);
  process.exit(1);
}

orgResponse.forEach((element) => {
  repos.push({
    name: element.name,
    full_name: element.full_name,
  });
});

console.log(repos);

//  get the commits for each repo
for await (const element of repos) {
  try {
    const commitList = [];

    for await (const data of getCommits(ORG, element.name)) {
      commitList.push(...data);
    }
    commitInfo.set(element.name, commitList);
    logSuccess(`Fetched commits for ${element.name}`);
  } catch (e) {
    logError(`${e.message} [repo: ${element.name}]`);
  }
}

// console.log(commitInfo);

console.log("\nFinished feching commits ... \n");

let output = "";
let commitUrl = [];
const reportMap = new Map();

for (const [repo, commits] of commitInfo) {
  commitUrl = [];

  for (const commit of commits) {
    if (commit.author.login.toLowerCase() === USER.toLowerCase()) {
      commitUrl.push(`${commit.html_url}\n`);
    }
  }

  if (commitUrl.length) {
    reportMap.set(repo, commitUrl);
  }

  // if (commitUrl.length === 0) {
  //   logError(`No commits found for ${USER} in ${repo}`);
  // }
}

// prepare output
for (const [repo, commits] of reportMap) {
  output += `${repo}\n\n`;
  output += commits.join("").trimEnd();
  output += "\n\n";
}

await fs.writeFile("output.txt", output);

// show report
console.log(`The following is the summary of commits by ${USER}: \n`);

for (const [repo, commits] of reportMap) {
  console.log(`${repo}: ${commits.length} commits`);
}

const totalTime = Date.now() - start;
console.log(`\nTotal time taken: ${totalTime / 1000} seconds\n`);
