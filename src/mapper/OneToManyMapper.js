export default class OneToManyMapper {
  constructor({ thisModel, thisField, otherModel, otherField }) {
    this.thisModel = thisModel;
    this.thisField = thisField;
    this.otherModel = otherModel;
    this.otherField = otherField;
  }

  parse(resource, relName, relValue, model, session) {
    if (!Array.isArray(relValue.data)) {
      // eslint-disable-next-line no-param-reassign
      relValue.data = [relValue.data];
    }
    const { items, itemsById } = session.state[this.otherModel];
    relValue.data.forEach((x) => {
      const { id } = x;
      if (itemsById[id] == null) {
        itemsById[id] = { id, [this.otherField]: resource.id };
        items.push(id);
      } else {
        itemsById[id] = {
          ...itemsById[id],
          [this.otherField]: resource.id,
        };
      }
    });
  }
}
