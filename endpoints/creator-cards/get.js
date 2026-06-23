const { createHandler } = require('@app-core/server');
const getCard = require('@app/services/creator-card/get-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'get',
  middlewares: [],
  async handler(rc, helpers) {
    const payload = {
      slug: rc.params.slug,
      access_code: rc.query.access_code,
    };
    const response = await getCard(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Card retrieved successfully',
      data: response,
    };
  },
});
