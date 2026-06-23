const { expect } = require('chai');
const { MockModelStubs } = require('@app/mock-models');
const { createCard, formatCard } = require('@app/services/creator-card/create-card');
const getCard = require('@app/services/creator-card/get-card');
const deleteCard = require('@app/services/creator-card/delete-card');

describe('Creator Cards API', () => {
  let configs = [];

  afterEach(() => {
    configs.forEach((c) => c.revert());
    configs = [];
  });

  function configureStub(method, options = {}) {
    const stubs = MockModelStubs.CreatorCard;
    const config = stubs.configureStubs({ method, ...options });
    configs.push(config);
    return config;
  }

  const validCardPayload = {
    title: 'Ada Designs Things',
    description: 'A creative designer building beautiful web experiences.',
    slug: 'ada-designs-things',
    creator_reference: 'abc123def456ghi789j0',
    links: [
      { title: 'Portfolio', url: 'https://ada.designs' },
      { title: 'GitHub', url: 'https://github.com/ada' },
    ],
    service_rates: {
      currency: 'USD',
      rates: [
        { name: 'Logo Design', description: 'Professional logo design', amount: 500 },
        { name: 'Web Design', amount: 1500 },
      ],
    },
    status: 'published',
    access_type: 'public',
  };

  const validPrivatePayload = {
    title: 'Private Portfolio',
    creator_reference: 'privref123456789012',
    status: 'published',
    access_type: 'private',
    access_code: 'abc123',
  };

  function buildCard(overrides) {
    return { ...validCardPayload, ...overrides };
  }

  describe('createCard', () => {
    it('should create a full card with all fields (Test 1)', async () => {
      const result = await createCard(validCardPayload);

      expect(result).to.have.property('id');
      expect(result).to.have.property('title', 'Ada Designs Things');
      expect(result).to.have.property('slug', 'ada-designs-things');
      expect(result).to.have.property('creator_reference', 'abc123def456ghi789j0');
      expect(result).to.have.property('status', 'published');
      expect(result).to.have.property('access_type', 'public');
      expect(result).to.not.have.property('access_code');
      expect(result).to.have.property('created');
      expect(result).to.have.property('updated');
      expect(result).to.have.property('deleted', null);
      expect(result.links).to.have.length(2);
      expect(result.service_rates.rates).to.have.length(2);
    });

    it('should auto-generate slug from title when slug is not provided (Test 2)', async () => {
      const payload = buildCard({ slug: undefined });
      const result = await createCard(payload);

      expect(result).to.have.property('slug');
      expect(result.slug).to.equal('ada-designs-things');
    });

    it('should create a private card with access code (Test 3)', async () => {
      const result = await createCard(validPrivatePayload);

      expect(result).to.have.property('access_type', 'private');
      expect(result).to.have.property('access_code', 'abc123');
    });

    it('should reject duplicate slug (Test 7)', async () => {
      configureStub('findOne', {
        docConfig: {
          slug: 'ada-designs-things',
          title: 'Existing Card',
          status: 'published',
        },
      });

      try {
        await createCard(validCardPayload);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('SL02');
        expect(err.isApplicationError).to.be.true;
      }
    });

    it('should reject private card without access code (Test 8)', async () => {
      const payload = {
        title: 'No Code',
        creator_reference: 'noref12345678901234',
        status: 'published',
        access_type: 'private',
      };

      try {
        await createCard(payload);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('AC01');
        expect(err.isApplicationError).to.be.true;
      }
    });

    it('should reject public card with access code (Test 9)', async () => {
      const payload = {
        title: 'Public With Code',
        creator_reference: 'pubref1234567890123',
        status: 'published',
        access_type: 'public',
        access_code: 'secret1',
      };

      try {
        await createCard(payload);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('AC05');
        expect(err.isApplicationError).to.be.true;
      }
    });

    it('should reject invalid status (Test 10)', async () => {
      const payload = buildCard({ status: 'archived' });

      try {
        await createCard(payload);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.isApplicationError).to.be.true;
      }
    });

    it('should reject decimal amounts in service_rates', async () => {
      const payload = buildCard({
        service_rates: {
          currency: 'USD',
          rates: [{ name: 'Logo', amount: 100.5 }],
        },
      });

      try {
        await createCard(payload);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.isApplicationError).to.be.true;
      }
    });

    it('should reject unsupported currency', async () => {
      const payload = buildCard({
        service_rates: {
          currency: 'EUR',
          rates: [{ name: 'Logo', amount: 100 }],
        },
      });

      try {
        await createCard(payload);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.isApplicationError).to.be.true;
      }
    });

    it('should reject invalid URL in links', async () => {
      const payload = buildCard({
        links: [{ title: 'Bad', url: 'ftp://bad.com' }],
      });

      try {
        await createCard(payload);
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.isApplicationError).to.be.true;
      }
    });

    it('should use id not _id in response', async () => {
      const result = await createCard(validCardPayload);

      expect(result).to.have.property('id');
      expect(result).to.not.have.property('_id');
    });
  });

  describe('getCard', () => {
    function mockFindOne(overrides) {
      configureStub('findOne', { docConfig: overrides });
    }

    it('should retrieve a public published card by slug (Test 4)', async () => {
      mockFindOne({ slug: 'ada-designs', status: 'published', access_type: 'public' });

      const result = await getCard({ slug: 'ada-designs' });

      expect(result).to.have.property('slug', 'ada-designs');
      expect(result).to.not.have.property('access_code');
      expect(result).to.have.property('status', 'published');
    });

    it('should retrieve a private card with correct access code (Test 5)', async () => {
      mockFindOne({
        slug: 'private-card',
        status: 'published',
        access_type: 'private',
        access_code: 'abc123',
      });

      const result = await getCard({ slug: 'private-card', access_code: 'abc123' });

      expect(result).to.have.property('slug', 'private-card');
      expect(result).to.not.have.property('access_code');
    });

    it('should return NF01 for non-existent slug (Test 11)', async () => {
      configureStub('findOne', { mockNull: true });

      try {
        await getCard({ slug: 'nonexistent' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('NF01');
      }
    });

    it('should return NF02 for draft card (Test 12)', async () => {
      mockFindOne({ slug: 'draft-card', status: 'draft', access_type: 'public' });

      try {
        await getCard({ slug: 'draft-card' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('NF02');
      }
    });

    it('should return AC03 for private card without access_code (Test 13)', async () => {
      mockFindOne({
        slug: 'private-card',
        status: 'published',
        access_type: 'private',
        access_code: 'abc123',
      });

      try {
        await getCard({ slug: 'private-card' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('AC03');
      }
    });

    it('should return AC04 for private card with wrong access_code (Test 14)', async () => {
      mockFindOne({
        slug: 'private-card',
        status: 'published',
        access_type: 'private',
        access_code: 'abc123',
      });

      try {
        await getCard({ slug: 'private-card', access_code: 'wrong' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('AC04');
      }
    });

    it('should return NF01 for deleted card (Test 16)', async () => {
      mockFindOne({ slug: 'deleted-card', deleted: 1700000000001 });

      try {
        await getCard({ slug: 'deleted-card' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('NF01');
      }
    });
  });

  describe('deleteCard', () => {
    function mockFindOne(overrides) {
      configureStub('findOne', { docConfig: overrides });
    }

    it('should delete a card with matching creator_reference (Test 6)', async () => {
      mockFindOne({
        slug: 'ada-designs',
        title: 'Ada Designs',
        creator_reference: 'abc123def456ghi789j0',
        status: 'published',
        access_type: 'public',
        links: [],
        created: 1700000000000,
        updated: 1700000000000,
        deleted: null,
      });

      const result = await deleteCard({
        slug: 'ada-designs',
        creator_reference: 'abc123def456ghi789j0',
      });

      expect(result).to.have.property('slug', 'ada-designs');
      expect(result).to.have.property('creator_reference', 'abc123def456ghi789j0');
    });

    it('should return NF01 for non-existent slug (Test 15)', async () => {
      configureStub('findOne', { mockNull: true });

      try {
        await deleteCard({ slug: 'nonexistent', creator_reference: 'abcdef12345678901234' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('NF01');
      }
    });

    it('should return NF01 for already deleted card', async () => {
      mockFindOne({
        slug: 'already-deleted',
        creator_reference: 'delref1234567890123',
        deleted: 1700000000001,
      });

      try {
        await deleteCard({ slug: 'already-deleted', creator_reference: 'delref1234567890123' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.errorCode).to.equal('NF01');
      }
    });

    it('should reject mismatched creator_reference', async () => {
      mockFindOne({
        slug: 'ada-designs',
        creator_reference: 'abc123def456ghi789j0',
        deleted: null,
      });

      try {
        await deleteCard({ slug: 'ada-designs', creator_reference: 'wrongref1234567890123' });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.isApplicationError).to.be.true;
      }
    });
  });

  describe('formatCard', () => {
    it('should convert _id to id', () => {
      const doc = { _id: 'test-id', title: 'Test', access_type: 'public' };
      const result = formatCard(doc);
      expect(result).to.have.property('id', 'test-id');
      expect(result).to.not.have.property('_id');
    });

    it('should not include access_code for public cards', () => {
      const doc = { _id: '1', title: 'T', access_type: 'public', access_code: null };
      const result = formatCard(doc);
      expect(result).to.not.have.property('access_code');
    });

    it('should include access_code for private cards', () => {
      const doc = { _id: '1', title: 'T', access_type: 'private', access_code: 'abc123' };
      const result = formatCard(doc);
      expect(result).to.have.property('access_code', 'abc123');
    });
  });
});
