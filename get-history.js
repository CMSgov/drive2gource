// This is meant to be run in Google Apps Script: see README.

const root = "items/YOUR_DIRECTORY_ID";

function doGet(e) {
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

    // out += activities.length + "\n";
  }

  let users = {};

  activities.forEach((act) => {
    const userId = act.actors[0].user.knownUser.personName;
    if (!users[userId]) {
      users[userId] = People.People.get(userId, { personFields: "names" });
    }
    act.actors[0].user.info = users[userId];
  });

  return ContentService.createTextOutput(
    activities.map(JSON.stringify).join("\n")
  );
}
