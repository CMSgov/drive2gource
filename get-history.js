// SPDX-License-Identifier: CC0-1.0

// This is meant to be run in Google Apps Script: see README.

const root = "items/YOUR_FOLDER_ID";

function exportActivity() {
  let ret = DriveActivity.Activity.query({
    pageSize: 100,
    ancestorName: root,
  });

  let activities = ret.activities;

  activities.reverse();

  let out = "";

  while (ret.nextPageToken && ret.nextPageToken.length > 0) {
    ret = DriveActivity.Activity.query({
      pageSize: 100,
      ancestorName: root,
      pageToken: ret.nextPageToken,
    });

    ret.activities.reverse();

    activities = ret.activities.concat(activities);

    console.log(`Fetched ${activities.length} activities...`);
  }

  let users = {};
  let parents = {};

  console.log(
    "Activities fetched. Fetching additional data (usernames and file parents)..."
  );

  // at this stage we do a progress report every 10 seconds
  let lastProgressReport = Date.now();

  activities.forEach((act, i) => {
    const userId = act.actors[0].user.knownUser.personName;
    if (!users[userId]) {
      users[userId] = People.People.get(userId, { personFields: "names" });
    }
    if (act.primaryActionDetail.create) {
      const id = act.targets[0].driveItem.name;
      const shortId = id.split("/")[1];
      if (!parents[id]) {
        const parentIter = DriveApp.getFileById(shortId).getParents();
        parents[id] = [];
        while (parentIter.hasNext()) {
          parents[id].push("items/" + parentIter.next().getId());
        }
      }
      act.targets[0]._d2g_parents = parents[id];
    }

    act.actors[0].user._d2g_info = users[userId];

    if (lastProgressReport + 1000 * 10 <= Date.now()) {
      console.log(`Fetched additional data for ${i + 1} activities...`);
      lastProgressReport = Date.now();
    }
  });

  const file = DriveApp.createFile(
    Utilities.newBlob(
      activities.map(JSON.stringify).join("\n"),
      "application/json",
      `${root.split("/")[1]}-${new Date().toISOString()}.ndjson`
    )
  );

  console.log("Log generated and saved to Google Drive:");
  console.log(file.getDownloadUrl());
}
