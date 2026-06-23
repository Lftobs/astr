const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCard = require('@app/repository/creator-card');
const Messages = require('@app/messages/creator-card');
const { formatCard } = require('./create-card');

const spec = `root {
  slug string<trim|minLength:1>
  access_code? string
}`;

const parsedSpec = validator.parse(spec);

async function getCard(serviceData) {
  const data = validator.validate(serviceData, parsedSpec);
  let response;

  try {
    const card = await CreatorCard.findOne({ query: { slug: data.slug, deleted: null } });

    if (!card) {
      throwAppError(Messages.NOT_FOUND, ERROR_CODE.NF01);
    }

    if (card.status === 'draft') {
      throwAppError(Messages.DRAFT_NOT_FOUND, ERROR_CODE.NF02);
    }

    if (card.access_type === 'private' && !data.access_code) {
      throwAppError(Messages.ACCESS_CODE_REQUIRED, ERROR_CODE.AC03);
    }

    if (card.access_type === 'private' && data.access_code !== card.access_code) {
      throwAppError(Messages.INVALID_ACCESS_CODE, ERROR_CODE.AC04);
    }

    const formatted = formatCard(card);
    delete formatted.access_code;

    response = formatted;
  } catch (error) {
    appLogger.errorX(error, 'get-card-error');
    throw error;
  }

  return response;
}

module.exports = getCard;
