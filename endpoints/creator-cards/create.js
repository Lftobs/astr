const { createHandler } = require('@app-core/server');
const { createCard } = require('@app/services/creator-card/create-card');

module.exports = createHandler({
  path: '/creator-cards',
  method: 'post',
  middlewares: [],
  async handler(rc, helpers) {
    const payload = rc.body;
    const response = await createCard(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Card created successfully',
      data: response,
    };
  },
});
