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
    expect(mapper.relationshipMappers).to.deep.equal({
      "Task:project": {
        thisModel: "Task",
        thisField: "project",
        otherModel: "Project",
        otherField: "tasks",
      },
      "Project:tasks": {
        thisModel: "Project",
        thisField: "tasks",
        otherModel: "Task",
        otherField: "project",
      },
      "Person:projects": {
        thisModel: "Person",
        thisField: "projects",
        otherModel: "Project",
        otherField: "assignees",
        throughModel: "PersonProjects",
        thisThroughField: "fromPersonId",
        otherThroughField: "toProjectId",
      },
      "Project:assignees": {
        thisModel: "Project",
        thisField: "assignees",
        otherModel: "Person",
        otherField: "projects",
        throughModel: "PersonProjects",
        thisThroughField: "toProjectId",
        otherThroughField: "fromPersonId",
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

  describe("basic", () => {
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

  describe("many-to-one", () => {
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
});

describe.only("parse many-to-many relationships", () => {
  class Book extends Model {
    static modelName = "Book";

    static jsonApiType = "books";

    static fields = {
      title: attr(),
      authors: many("Author", "books"),
    };
  }

  class Author extends Model {
    static modelName = "Author";

    static jsonApiType = "authors";

    static fields = {
      fullName: attr(),
    };
  }

  const orm = new ORM();
  orm.register(Book, Author);

  const mapper = new JsonApiToOrmMapper(orm);

  let session;

  beforeEach(() => {
    session = orm.session();
  });

  afterEach(() => {
    session = null;
  });

  it("should parse relationship from this side", () => {
    global.console.log(mapper.relationshipMap);
    mapper.parse(
      {
        data: [
          {
            type: "books",
            id: "1",
            attributes: {
              title: "book1",
            },
            relationships: {
              authors: {
                data: [
                  { type: "authors", id: "1" },
                  { type: "authors", id: "2" },
                ],
              },
            },
          },
          {
            type: "books",
            id: "2",
            attributes: {
              title: "book2",
            },
            relationships: {
              authors: {
                data: [
                  { type: "authors", id: "2" },
                  { type: "authors", id: "3" },
                ],
              },
            },
          },
        ],
      },
      session
    );

    expect(session.state).to.deep.equal({
      Book: {
        meta: { maxId: 2 },
        items: ["1", "2"],
        itemsById: {
          1: {
            id: "1",
            title: "book1",
          },
          2: {
            id: "2",
            title: "book2",
          },
        },
      },
      Author: {
        meta: {},
        items: ["1", "2", "3"],
        itemsById: {
          1: { id: "1" },
          2: { id: "2" },
          3: { id: "3" },
        },
      },
      BookAuthors: {
        meta: { maxId: 6 },
        items: [1, 2, 4, 5],
        itemsById: {
          1: {
            id: 1,
            fromBookId: "1",
            toAuthorId: "1",
          },
          2: {
            id: 2,
            fromBookId: "1",
            toAuthorId: "2",
          },
          4: {
            id: 4,
            fromBookId: "2",
            toAuthorId: "2",
          },
          5: {
            id: 5,
            fromBookId: "2",
            toAuthorId: "3",
          },
        },
      },
    });
  });
});
