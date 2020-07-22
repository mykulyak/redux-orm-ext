import invariant from "invariant";

export default class JsonApiToOrmMapper {
  constructor(orm) {
    const [resourceTypeMap, modelNameMap] = orm.registry.reduce(
      (accum, modelClass) => {
        if (modelClass.jsonApiType) {
          invariant(
            accum[0][modelClass.jsonApiType] == null,
            `Duplicate JSON API resource type ${modelClass.jsonApiType}`
          );
          invariant(
            accum[1][modelClass.modelName] == null,
            `Duplicate model name ${modelClass.modelName}`
          );
          // eslint-disable-next-line no-param-reassign
          accum[0][modelClass.jsonApiType] = modelClass.modelName;
          // eslint-disable-next-line no-param-reassign
          accum[1][modelClass.modelName] = modelClass.jsonApiType;
        }
        return accum;
      },
      [{}, {}]
    );

    this.orm = orm;
    this.resourceTypeMap = resourceTypeMap;
    this.modelNameMap = modelNameMap;
  }

  parse(document, session) {
    const { data, included } = document;
    if (included) {
      included.forEach((resource) => this.parseResource(resource, session));
    }
    if (Array.isArray(data)) {
      data.forEach((resource) => this.parseResource(resource, session));
    } else {
      this.parseResource(data, session);
    }
  }

  parseResource(resource, session) {
    const modelName = this.resourceTypeMap[resource.type];
    const modelClass = session[modelName];
    if (modelClass) {
      modelClass.upsert({
        id: resource.id,
        ...resource.attributes,
      });
    }
  }
}
