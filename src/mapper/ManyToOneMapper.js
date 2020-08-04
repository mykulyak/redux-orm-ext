export default class ManyToOneMapper {
  constructor({ thisModel, thisField, otherModel, otherField }) {
    this.thisModel = thisModel;
    this.thisField = thisField;
    this.otherModel = otherModel;
    this.otherField = otherField;
  }

  parse(resource, relName, relValue, model, session) {
    const relId = relValue.data.id;
    // eslint-disable-next-line no-param-reassign
    model[relName] = relId;
    const { items, itemsById } = session.state[this.otherModel];
    if (itemsById[resource.id] == null) {
      itemsById[relId] = { id: relId };
      items.push(relId);
    }
  }
}
