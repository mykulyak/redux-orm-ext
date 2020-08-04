import { ForeignKey, ManyToMany } from "redux-orm";
import invariant from "invariant";

import OneToManyMapper from "./OneToManyMapper";
import ManyToOneMapper from "./ManyToOneMapper";
import ManyToManyMapper from "./ManyToManyMapper";

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

    this.relationshipMappers = orm.registry.reduce((accum, modelClass) => {
      Object.entries(modelClass.fields).forEach(([key, value]) => {
        if (value instanceof ForeignKey) {
          // eslint-disable-next-line no-param-reassign
          accum[`${modelClass.modelName}:${key}`] = new ManyToOneMapper({
            thisModel: modelClass.modelName,
            thisField: key,
            otherModel: value.toModelName,
            otherField: value.relatedName,
          });
          // eslint-disable-next-line no-param-reassign
          accum[
            `${value.toModelName}:${value.relatedName}`
          ] = new OneToManyMapper({
            thisModel: value.toModelName,
            thisField: value.relatedName,
            otherModel: modelClass.modelName,
            otherField: key,
          });
        } else if (value instanceof ManyToMany) {
          const throughModelName = value.getThroughModelName(key, modelClass);
          const throughFields = value.getThroughFields(
            key,
            modelClass,
            orm.get(value.toModelName),
            orm.get(value.getThroughModelName(key, modelClass))
          );
          // eslint-disable-next-line no-param-reassign
          accum[`${modelClass.modelName}:${key}`] = new ManyToManyMapper({
            thisModel: modelClass.modelName,
            thisField: key,
            otherModel: value.toModelName,
            otherField: value.relatedName,
            throughModel: throughModelName,
            thisThroughField: throughFields.from,
            otherThroughField: throughFields.to,
          });
          // eslint-disable-next-line no-param-reassign
          accum[
            `${value.toModelName}:${value.relatedName}`
          ] = new ManyToManyMapper({
            thisModel: value.toModelName,
            thisField: value.relatedName,
            otherModel: modelClass.modelName,
            otherField: key,
            throughModel: throughModelName,
            thisThroughField: throughFields.to,
            otherThroughField: throughFields.from,
          });
        }
      });
      return accum;
    }, {});

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
      const model = modelClass.upsert({
        id: resource.id,
        ...resource.attributes,
      });
      Object.entries(resource.relationships || {}).forEach(([key, value]) => {
        const mapperKey = `${modelName}:${key}`;
        const mapper = this.relationshipMappers[mapperKey];
        invariant(mapper != null, `Unknown relationship ${modelName}.${key}`);
        mapper.parse(resource, key, value, model, session);
      });
    }
  }
}
