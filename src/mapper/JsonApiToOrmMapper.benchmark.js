/* eslint-disable max-classes-per-file */
import { ORM, Model, attr, fk, many } from "redux-orm";

import JsonApiToOrmMapper from "./JsonApiToOrmMapper";

class Project extends Model {
  static modelName = "Project";

  static jsonApiType = "projects";

  static fields = {
    name: attr(),
  };
}

class Task extends Model {
  static modelName = "Task";

  static jsonApiType = "tasks";

  static fields = {
    project: fk("Project", "tasks"),
  };
}

class Person extends Model {
  static modelName = "Person";

  static jsonApiType = "people";

  static fields = {
    projects: many("Project", "assignees"),
  };
}

const orm = new ORM();
orm.register(Project, Task, Person);

const mapper = new JsonApiToOrmMapper(orm);

// prepare input data

const doc = {
  data: Array.from({ length: 1000 }, (_x, i) => ({
    type: "projects",
    id: String(i + 1),
    attributes: { name: `p${i + 1}` },
    relationships: {
      tasks: {
        data: Array.from({ length: 500 }, (_y, j) => ({
          type: "tasks",
          id: j + i + 1,
        })),
      },
    },
  })),
};

// run benchmarks

const session = orm.session();
const timeStart = Date.now();
mapper.parse(doc, session);
const timeEnd = Date.now();
// global.console.warn(session.state);
global.console.warn({
  taskCount: session.Task.count(),
  projectCount: session.Project.count(),
  timeSpent: timeEnd - timeStart,
});
