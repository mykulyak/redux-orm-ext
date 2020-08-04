/* eslint-disable max-classes-per-file */
import { expect } from "chai";
import { ORM, Model, attr, fk, many } from "redux-orm";

import JsonApiToOrmMapper from "./JsonApiToOrmMapper";

describe("construction", () => {
  class Project extends Model {
    static modelName = "Project";

    static jsonApiType = "projects";
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

  let orm;

  beforeEach(() => {
    orm = new ORM();
    orm.register(Project, Task, Person);
  });

  afterEach(() => {
    orm = null;
  });

  it("should create resource <-> model maps", () => {
    const mapper = new JsonApiToOrmMapper(orm);
    // Testing implementation details, I know.
    expect(mapper.resourceTypeMap).to.deep.equal({
      projects: "Project",
      tasks: "Task",
      people: "Person",
    });
    expect(mapper.modelNameMap).to.deep.equal({
      Project: "projects",
      Task: "tasks",
      Person: "people",
    });
  });

  it("should break if duplicate resource type is encountered", () => {
    class DuplicateTask extends Model {
      static modelName = "DuplicateTask";

      static jsonApiType = "tasks";
    }
    orm.register(DuplicateTask);

    expect(() => new JsonApiToOrmMapper(orm)).to.throw();
  });

  it("should not map models with emptish jsonApiType attributes", () => {
    class Task2 extends Model {
      static modelName = "Task2";

      static jsonApiType = "";
    }

    class Task3 extends Model {
      static modelName = "Task3";
    }

    orm.register(Task2, Task3);

    const mapper = new JsonApiToOrmMapper(orm);
    // Testing implementation details, I know.
    expect(mapper.resourceTypeMap).to.deep.equal({
      projects: "Project",
      tasks: "Task",
      people: "Person",
    });
    expect(mapper.modelNameMap).to.deep.equal({
      Project: "projects",
      Task: "tasks",
      Person: "people",
    });
  });

  it("creates relationship map for FK and M2M relationships", () => {
    const mapper = new JsonApiToOrmMapper(orm);
    expect(mapper.relationshipMap).to.deep.equal({
      "Task:project": {
        type: "fk-child",
        otherModelName: "Project",
        otherFieldName: "tasks",
      },
      "Project:tasks": {
        type: "fk-parent",
        otherModelName: "Task",
        otherFieldName: "project",
      },
      "Person:projects": {
        type: "many-parent",
        otherModelName: "PersonProjects",
        otherFieldName: "fromPersonId",
      },
      "Project:assignees": {
        type: "many-parent",
        otherModelName: "PersonProjects",
        otherFieldName: "toProjectId",
      },
      "PersonProjects:fromPersonId": {
        type: "many-child",
        otherModelName: "Person",
        otherFieldName: "projects",
      },
      "PersonProjects:toProjectId": {
        type: "many-child",
        otherModelName: "Project",
        otherFieldName: "assignees",
      },
    });
  });
});

describe("parse", () => {
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

  const orm = new ORM();
  orm.register(Project, Task);

  const mapper = new JsonApiToOrmMapper(orm);

  let session;

  beforeEach(() => {
    session = orm.session();
  });

  afterEach(() => {
    session = null;
  });

  it("should parse single primary resource", () => {
    mapper.parse(
      {
        data: {
          type: "projects",
          id: "12",
          attributes: {
            name: "Project 12",
          },
        },
      },
      session
    );

    expect(session.Project.all().toRefArray()).to.deep.equal([
      { id: "12", name: "Project 12" },
    ]);
  });

  it("should parse multiple primary resources", () => {
    mapper.parse(
      {
        data: [
          {
            type: "projects",
            id: "1",
            attributes: {
              name: "Project#1",
            },
          },
          {
            type: "projects",
            id: "2",
            attributes: {
              name: "Project#2",
            },
          },
        ],
      },
      session
    );

    expect(session.Project.all().toRefArray()).to.deep.equal([
      { id: "1", name: "Project#1" },
      { id: "2", name: "Project#2" },
    ]);
  });

  it("should parse included resources, before primary ones", () => {
    mapper.parse(
      {
        data: [
          {
            type: "tasks",
            id: "t:1",
          },
        ],
        included: [
          {
            type: "projects",
            id: "p:1",
            attributes: {
              name: "Project #1",
            },
          },
        ],
      },
      session
    );

    expect(session.Project.all().toRefArray()).to.deep.equal([
      { id: "p:1", name: "Project #1" },
    ]);
    expect(session.Task.all().toRefArray()).to.deep.equal([{ id: "t:1" }]);
  });

  it("should parse FK relationships from child side", () => {
    mapper.parse(
      {
        data: {
          type: "tasks",
          id: "1",
          attributes: {},
          relationships: {
            project: {
              data: {
                type: "projects",
                id: "2",
              },
            },
          },
        },
      },
      session
    );
    expect(session.state).to.deep.equal({
      Task: {
        itemsById: {
          1: {
            id: "1",
            project: "2",
          },
        },
        items: ["1"],
        meta: { maxId: 1 },
      },
      Project: {
        itemsById: {
          2: {
            id: "2",
          },
        },
        items: ["2"],
        meta: {},
      },
    });
  });

  it("should parse FK relationships from parent side", () => {
    mapper.parse(
      {
        data: {
          type: "projects",
          id: "1",
          attributes: {
            name: "p1",
          },
          relationships: {
            tasks: {
              data: [
                { type: "tasks", id: "1" },
                { type: "tasks", id: "2" },
                { type: "tasks", id: "3" },
              ],
            },
          },
        },
      },
      session
    );
    expect(session.state).to.deep.equal({
      Task: {
        meta: {},
        items: ["1", "2", "3"],
        itemsById: {
          1: { id: "1", project: "1" },
          2: { id: "2", project: "1" },
          3: { id: "3", project: "1" },
        },
      },
      Project: {
        meta: { maxId: 1 },
        items: ["1"],
        itemsById: {
          1: { id: "1", name: "p1" },
        },
      },
    });
  });
});
