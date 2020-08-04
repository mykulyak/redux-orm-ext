import { ForeignKey, ManyToMany } from "redux-orm";
import invariant from "invariant";

const FK_PARENT = "fk-parent";
const FK_CHILD = "fk-child";
const MANY_PARENT = "many-parent";
const MANY_CHILD = "many-child";

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

    this.relationshipMap = orm.registry.reduce((accum, modelClass) => {
      Object.entries(modelClass.fields).forEach(([key, value]) => {
        if (value instanceof ForeignKey) {
          // eslint-disable-next-line no-param-reassign
          accum[`${modelClass.modelName}:${key}`] = {
            type: FK_CHILD,
            otherModelName: value.toModelName,
            otherFieldName: value.relatedName,
          };
          // eslint-disable-next-line no-param-reassign
          accum[`${value.toModelName}:${value.relatedName}`] = {
            type: FK_PARENT,
            otherModelName: modelClass.modelName,
            otherFieldName: key,
          };
        } else if (value instanceof ManyToMany) {
          const throughModelName = value.getThroughModelName(key, modelClass);
          const throughFields = value.getThroughFields(
            key,
            modelClass,
            orm.get(value.toModelName),
            orm.get(value.getThroughModelName(key, modelClass))
          );

          const throughThisFieldName = throughFields.from;
          const throughOtherFieldName = throughFields.to;

          // eslint-disable-next-line no-param-reassign
          accum[`${modelClass.modelName}:${key}`] = {
            type: MANY_PARENT,
            otherModelName: throughModelName,
            otherFieldName: throughThisFieldName,
          };
          // eslint-disable-next-line no-param-reassign
          accum[`${throughModelName}:${throughThisFieldName}`] = {
            type: MANY_CHILD,
            otherModelName: modelClass.modelName,
            otherFieldName: key,
          };
          // eslint-disable-next-line no-param-reassign
          accum[`${value.toModelName}:${value.relatedName}`] = {
            type: MANY_PARENT,
            otherModelName: throughModelName,
            otherFieldName: throughOtherFieldName,
          };
          // eslint-disable-next-line no-param-reassign
          accum[`${throughModelName}:${throughOtherFieldName}`] = {
            type: MANY_CHILD,
            otherModelName: value.toModelName,
            otherFieldName: value.relatedName,
          };
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
      modelClass.upsert({
        id: resource.id,
        ...resource.attributes,
      });
    }
  }
}
