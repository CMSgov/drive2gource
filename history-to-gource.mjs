// SPDX-License-Identifier: CC0-1.0

import * as fs from "fs/promises";

function todo(desc) {
  throw new Error(`Not implemented: ${desc}.`);
}

function assert(bool, desc) {
  if (!bool) throw new Error(`Assertion failed: ${desc}.`);
}

const [, , rootId, dataPath, currentUserName] = process.argv;

if (!dataPath) {
  console.log(
    'Usage: node history-to-gource.mjs RootDirectoryId path/to/activity/log ["Your Name"]'
  );
  process.exit(1);
}

const root = `items/${rootId}`;

const data = await fs.readFile(dataPath, "utf-8");

const activities = data.split("\n").map(JSON.parse);
const paths = {};
const colors = {};

function getTargetId(activity) {
  assert(activity.targets.length == 1, "activity with multiple targets");

  if (activity.targets[0].driveItem) {
    return activity.targets[0].driveItem.name;
  } else if (activity.targets[0].fileComment) {
    return activity.targets[0].fileComment.parent.name;
  }

  todo("unknown target type");
}

function dateToUnix(date) {
  return Math.round(Date.parse(date) / 1000);
}

function getColor(mimeType) {
  const colors = {
    "application/msword": "0000FF",
    "application/pdf": "FF0000",
    "application/vnd.google-apps.document": "0000FF",
    "application/vnd.google-apps.folder": "FFFFFF",
    "application/vnd.google-apps.shortcut": "FFFFFF",
    "application/vnd.google-apps.spreadsheet": "00FF00",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "FFA500",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "00FF00",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "0000FF",
    "image/png": "FF00FF",
  };

  return colors[mimeType] || "FFFFFF";
}

function pathHasPrefix(path, prefix) {
  if (path.length < prefix.length) {
    return false;
  }

  return prefix.every((element, i) => path[i] == element);
}

// If `path` has prefix `oldPrefix`, return the path with the prefix
// `newPrefix` instead. Otherwise, return null.
function replacePathPrefix(path, oldPrefix, newPrefix) {
  if (!pathHasPrefix(path, oldPrefix)) {
    return null;
  }

  return [...newPrefix, ...path.slice(oldPrefix.length)];
}

function moveFolder(activity, oldFolder, newFolder) {
  Object.keys(paths).forEach((itemId) => {
    const newPath = replacePathPrefix(paths[itemId], oldFolder, newFolder);

    if (newPath) {
      logAction(activity, "D", itemId);
      paths[itemId] = newPath;
      logAction(activity, "A", itemId);
    }
  });
}

function deleteFolder(activity, folder) {
  Object.keys(paths).forEach((itemId) => {
    if (pathHasPrefix(paths[itemId], folder)) {
      logAction(activity, "D", itemId);
      delete paths[itemId];
    }
  });
}

// fallback called when a file starts showing up with no indication as to its
// path, and we need to make an inference as to its path at the time
function discoverPath(activity) {
  // first, was the file moved later? if so, use the removedParents from
  // there: we want to find the first removedParent we recognize
  const firstRemovedParent = activities
    .filter((act) => getTargetId(act) == getTargetId(activity))
    .map((act) => act.primaryActionDetail?.move?.removedParents)
    .filter((parents) => parents)
    .flat()
    .find((parent) => paths[parent.driveItem.name]);

  let parent;

  if (firstRemovedParent) {
    parent = firstRemovedParent.driveItem.name;
  } else {
    // failing that, use the current parent, which the Apps Script obtains in
    // case it's needed for such cases
    assert(
      activity.targets[0]._d2g_parents.length == 1,
      "file has multiple parents"
    );
    parent = activity.targets[0]._d2g_parents[0];
  }

  paths[getTargetId(activity)] = [
    ...paths[parent],
    activity.targets[0].driveItem.title,
  ];
}

let generatedEvents = 0;

function logAction(activity, type, target = getTargetId(activity)) {
  // console.error(type, target, paths[target]);
  if (!paths[target]) {
    // create with no associated move, or file that just randomly starts
    // getting edits with neither a create nor a move first; both are known
    // to happen
    if (type == "D") {
      // just ignore double deletes - for some example, we can sometimes get
      // a separate delete event for a file in a folder that was just deleted
      return;
    }
    discoverPath(activity);
  }

  if (!colors[target]) {
    assert(
      target == getTargetId(activity),
      "can't determine color for file first seen in a folder move(!)"
    );
    colors[target] = getColor(activity.targets[0].driveItem.mimeType);
  }

  let name;
  if (activity.actors[0].user.knownUser.isCurrentUser) {
    if (currentUserName) {
      name = currentUserName;
    } else {
      throw new Error(
        "This log contains edits by you (or the user who downloaded the log). Google's API makes it difficult to automatically obtain the current user's name, so you'll need to manually provide this on the command line, after the path to the log."
      );
    }
  } else {
    name = activity.actors[0].user._d2g_info.names?.[0]?.displayName;
  }

  console.log(
    `${dateToUnix(activity.timestamp)}|${name}|${type}|/${paths[target].join(
      "/"
    )}|${colors[target]}`
  );

  generatedEvents++;
}

let successfulActivities = 0;
let errors = 0;

activities.forEach((activity) => {
  try {
    assert(activity.targets.length == 1, "activity has multiple targets");
    assert(activity.timestamp, "activity has no timestamp");

    if (activity.primaryActionDetail.create) {
      assert(activity.actors.length == 1, "activity has multiple targets");
      if (getTargetId(activity) == root) {
        paths[getTargetId(activity)] = [];

        logAction(activity, "A");
      } else {
        const moveAction = activity.actions.find((x) => x.detail.move)?.detail
          ?.move;

        // often, a document created in a directory is modelled as a create
        // with a bundled move, in which case we can get the parents this way
        if (moveAction) {
          assert(moveAction.addedParents, "create-move didn't add parents");
          assert(
            moveAction.addedParents.length == 1,
            "create-move added multiple parents"
          );
          assert(!moveAction.removedParents, "create-move removed parents");
          assert(
            !paths[getTargetId(activity)],
            "create-move for a file that already exists"
          );

          const parent = paths[moveAction.addedParents[0].driveItem.name];
          assert(parent, "create-move into an unknown parent");
          paths[getTargetId(activity)] = [
            ...parent,
            activity.targets[0].driveItem.title,
          ];
        }

        logAction(activity, "A");
      }
    } else if (activity.primaryActionDetail.move) {
      if (
        activity.primaryActionDetail.move.addedParents &&
        activity.primaryActionDetail.move.addedParents.length == 1 &&
        (!activity.primaryActionDetail.move.removedParents ||
          (activity.primaryActionDetail.move.removedParents.every(
            (p) => !paths[p.driveItem.name]
          ) &&
            !paths[getTargetId(activity)]))
      ) {
        // moved from outside; this is, for our purposes, a create

        const parent =
          paths[
            activity.primaryActionDetail.move.addedParents[0].driveItem.name
          ];
        assert(parent, "move from outside into unknown parent");
        paths[getTargetId(activity)] = [
          ...parent,
          activity.targets[0].driveItem.title,
        ];

        logAction(activity, "A");
      } else if (
        (!activity.primaryActionDetail.move.addedParents ||
          activity.primaryActionDetail.move.addedParents.every(
            (p) => !paths[p.driveItem.name]
          )) &&
        activity.primaryActionDetail.move.removedParents &&
        activity.primaryActionDetail.move.removedParents.every(
          (p) => paths[p.driveItem.name]
        ) &&
        paths[getTargetId(activity)]
      ) {
        // moved to outside; for our purposes, a delete
        logAction(activity, "D");

        const oldPath = paths[getTargetId(activity)];
        delete paths[getTargetId(activity)];

        if (activity.targets[0].driveItem.driveFolder) {
          deleteFolder(activity, oldPath);
        }
      } else if (
        activity.primaryActionDetail.move.addedParents &&
        activity.primaryActionDetail.move.addedParents.length == 1 &&
        paths[
          activity.primaryActionDetail.move.addedParents[0].driveItem.name
        ] &&
        activity.primaryActionDetail.move.removedParents &&
        activity.primaryActionDetail.move.removedParents.length == 1 &&
        paths[
          activity.primaryActionDetail.move.removedParents[0].driveItem.name
        ]
      ) {
        // move within the folder

        logAction(activity, "D");

        const parent =
          paths[
            activity.primaryActionDetail.move.addedParents[0].driveItem.name
          ];
        const oldPath = [...paths[getTargetId(activity)]];
        paths[getTargetId(activity)] = [
          ...parent,
          activity.targets[0].driveItem.title,
        ];

        logAction(activity, "A");

        if (activity.targets[0].driveItem.driveFolder) {
          moveFolder(activity, oldPath, paths[getTargetId(activity)]);
        }
      } else if (
        activity.primaryActionDetail.move.addedParents.every(
          (x) => !paths[x]
        ) &&
        activity.primaryActionDetail.move.removedParents.every((x) => !paths[x])
      ) {
        // moved from an external folder to another external folder. not
        // entirely sure why we get these - maybe things that end up in
        // scope later? in any case, ignore it
      } else {
        todo("unknown move type");
      }
    } else if (activity.primaryActionDetail.comment) {
      logAction(activity, "M");
    } else if (activity.primaryActionDetail.rename) {
      const path = paths[getTargetId(activity)];
      if (!path) {
        // annoying edge case: first we hear of a file is it getting renamed.
        // google is funny sometimes.
        logAction(activity, "A");
      } else {
        logAction(activity, "D");

        const path = paths[getTargetId(activity)];
        const oldPath = [...path];
        path[path.length - 1] = activity.primaryActionDetail.rename.newTitle;

        logAction(activity, "A");

        if (activity.targets[0].driveItem.driveFolder) {
          moveFolder(activity, oldPath, path);
        }
      }
    } else if (activity.primaryActionDetail.edit) {
      logAction(activity, "M");
    } else if (activity.primaryActionDetail.permissionChange) {
      logAction(activity, "M");
    } else if (activity.primaryActionDetail.delete) {
      logAction(activity, "D");

      let path = paths[getTargetId(activity)];
      delete paths[getTargetId(activity)];

      if (path && activity.targets[0].driveItem.driveFolder) {
        deleteFolder(activity, path);
      }
    } else {
      todo("unknown activity type");
    }

    successfulActivities++;
  } catch (e) {
    if (process.env.D2G_DEBUG) {
      console.error(
        `Error encountered while parsing this log entry: ${JSON.stringify(
          activity
        )}`
      );
      console.error(e);
    } else {
      console.error(e.toString());
    }
    errors++;
  }
});

// not really an error, but there's no better-named function for logging to stderr
console.error(
  `Converted ${successfulActivities} activities into ${generatedEvents} events.`
);
if (errors > 0) {
  console.error(
    `Warning: ${errors} activit(ies) skipped due to errors. Set D2G_DEBUG=1 for more detail.`
  );
}
