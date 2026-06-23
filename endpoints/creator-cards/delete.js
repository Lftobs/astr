const { createHandler } = require('@app-core/server');
const deleteCard = require('@app/services/creator-card/delete-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'delete',
  middlewares: [],
  async handler(rc, helpers) {
    const payload = {
      slug: rc.params.slug,
      creator_reference: rc.body.creator_reference,
    };
    const response = await deleteCard(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Card deleted successfully',
      data: response,
    };
  },
});
