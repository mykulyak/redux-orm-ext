/* eslint-disable max-classes-per-file */
import { expect } from "chai";
import { ORM, Model, attr, fk } from "redux-orm";

import JsonApiToOrmMapper from "./JsonApiToOrmMapper";

describe("construction", () => {
  class Project extends Model {
    static modelName = "Project";

    static jsonApiType = "projects";
  }

  class Task extends Model {
    static modelName = "Task";

    static jsonApiType = "tasks";
  }

  let orm;

  beforeEach(() => {
    orm = new ORM();
    orm.register(Project, Task);
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
    });
    expect(mapper.modelNameMap).to.deep.equal({
      Project: "projects",
      Task: "tasks",
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
    });
    expect(mapper.modelNameMap).to.deep.equal({
      Project: "projects",
      Task: "tasks",
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
});