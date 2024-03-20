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
  let seenFiles = {};

  console.log(
    "Activities fetched. Fetching additional data (usernames and file parents)..."
  );

  // at this stage we do a progress report every 10 seconds
  let lastProgressReport = Date.now();

  activities.forEach((act, i) => {
    if (
      act.targets[0].driveItem &&
      !seenFiles[act.targets[0].driveItem.name] &&
      !act.actions.some((x) => x.detail.move)
    ) {
      // first time we're seeing a file, and the activity doesn't have a move
      // component; grab its current parents in case we need them as a fallback
      const id = act.targets[0].driveItem.name;
      const shortId = id.split("/")[1];

      try
      {
        const parentIter = DriveApp.getFileById(shortId).getParents();
        let parents = [];
        while (parentIter.hasNext()) {
          parents.push("items/" + parentIter.next().getId());
        }
        act.targets[0]._d2g_parents = parents;
        seenFiles[id] = true;
      }
      catch(e)
      {
        console.log(e);
        console.log("Could not parse file by Id!");
      }
      
    }

    if (lastProgressReport + 1000 * 10 <= Date.now()) {
      console.log(`Fetched additional data for ${i + 1} activities...`);
      lastProgressReport = Date.now();
    }

    if (!act.actors[0].user || act.actors[0].user.deletedUser)
    {
      return;
    }

    const userId = act.actors[0].user.knownUser.personName;
    
    if (!users[userId]) {
      try{
        users[userId] = People.People.get(userId, { personFields: "names" });
      }
      catch(e)
      {
        console.log(e);
        console.log("Could not get user by ID!");
        return;
      }
    }

    act.actors[0].user._d2g_info = users[userId];
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
