const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCard = require('@app/repository/creator-card');
const Messages = require('@app/messages/creator-card');
const { formatCard } = require('./create-card');

const spec = `root {
  slug string<trim|minLength:1>
  creator_reference string<length:20>
}`;

const parsedSpec = validator.parse(spec);

async function deleteCard(serviceData) {
  const data = validator.validate(serviceData, parsedSpec);
  let response;

  try {
    const card = await CreatorCard.findOne({ query: { slug: data.slug, deleted: null } });

    if (!card) {
      throwAppError(Messages.NOT_FOUND, ERROR_CODE.NF01);
    }

    if (data.creator_reference !== card.creator_reference) {
      throwAppError(Messages.INVALID_CREATOR_REFERENCE, ERROR_CODE.INVLDDATA);
    }

    await CreatorCard.updateOne({
      query: { slug: data.slug, deleted: null },
      updateValues: { deleted: Date.now() },
    });

    const updatedCard = await CreatorCard.findOne({ query: { _id: card._id } });
    response = formatCard(updatedCard);
  } catch (error) {
    appLogger.errorX(error, 'delete-card-error');
    throw error;
  }

  return response;
}

module.exports = deleteCard;
