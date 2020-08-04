export default class ManyToManyMapper {
  constructor({
    thisModel,
    thisField,
    otherModel,
    otherField,
    throughModel,
    thisThroughField,
    otherThroughField,
  }) {
    this.thisModel = thisModel;
    this.thisField = thisField;
    this.otherModel = otherModel;
    this.otherField = otherField;
    this.throughModel = throughModel;
    this.thisThroughField = thisThroughField;
    this.otherThroughField = otherThroughField;
  }

  parse(resource, relName, relValue, model, session) {
    const { items: otherItems, itemsById: otherItemsById } = session.state[
      this.otherModel
    ];
    const {
      items: throughItems,
      itemsById: throughItemsById,
      meta,
    } = session.state[this.throughModel];

    const pairs = new Set();
    relValue.data.forEach(({ id }) => {
      if (!otherItemsById[id]) {
        otherItemsById[id] = { id };
        otherItems.push(id);
      }
      pairs.add(`${resource.id}:${id}`);
    });

    Object.values(throughItemsById).forEach((item) => {
      const pair = `${item[this.thisThroughField]}:${
        item[this.otherThroughField]
      }`;
      pairs.delete(pair);
    });

    let nextId = (meta.maxId || 0) + 1;
    pairs.forEach((pair) => {
      const [id1, id2] = pair.split(":");
      throughItemsById[nextId] = {
        id: nextId,
        [this.thisThroughField]: id1,
        [this.otherThroughField]: id2,
      };
      throughItems.push(nextId);
      nextId += 1;
    });
    meta.maxId = nextId;
  }
}
