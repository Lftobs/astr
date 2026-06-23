const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { ulid } = require('@app-core/randomness');
const CreatorCard = require('@app/repository/creator-card');
const Messages = require('@app/messages/creator-card');

const spec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description? string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<length:6>
}`;

const parsedSpec = validator.parse(spec);

function formatCard(doc) {
  const card = {
    id: doc._id,
    title: doc.title,
    description: doc.description,
    slug: doc.slug,
    creator_reference: doc.creator_reference,
    links: doc.links || [],
    service_rates: doc.service_rates || null,
    status: doc.status,
    access_type: doc.access_type,
    access_code: doc.access_code || null,
    created: doc.created,
    updated: doc.updated,
    deleted: doc.deleted || null,
  };

  return card;
}

function generateSlug(title) {
  let slug = title.toLowerCase();
  slug = slug.replaceAll(' ', '-');
  let result = '';
  for (let i = 0; i < slug.length; i++) {
    const ch = slug[i];
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '-' || ch === '_') {
      result += ch;
    }
  }
  if (result.length < 5) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    result += `-${suffix}`;
  }
  return result;
}

function isValidUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function isValidCurrency(currency) {
  const supported = ['NGN', 'USD', 'GBP', 'GHS'];
  return supported.includes(currency.toUpperCase());
}

async function createCard(serviceData) {
  const data = validator.validate(serviceData, parsedSpec);
  let response;

  try {
    if (data.access_type === 'private' && !data.access_code) {
      throwAppError(Messages.MISSING_ACCESS_CODE, ERROR_CODE.AC01);
    }

    if (data.access_type !== 'private' && data.access_code) {
      throwAppError(Messages.PUBLIC_WITH_ACCESS_CODE, ERROR_CODE.AC05);
    }

    if (data.service_rates) {
      if (!isValidCurrency(data.service_rates.currency)) {
        throwAppError('Unsupported currency. Supported: NGN, USD, GBP, GHS', ERROR_CODE.INVLDDATA);
      }
      data.service_rates.rates.forEach((rate) => {
        if (rate.amount !== Math.floor(rate.amount)) {
          throwAppError('Amount must be a whole number', ERROR_CODE.INVLDDATA);
        }
      });
    }

    if (data.links) {
      data.links.forEach((link) => {
        if (!isValidUrl(link.url)) {
          throwAppError('URL must start with http:// or https://', ERROR_CODE.INVLDDATA);
        }
      });
    }

    const existingTitle = await CreatorCard.findOne({
      query: { title: data.title, deleted: null },
    });
    if (existingTitle) {
      throwAppError('A card with this title already exists', ERROR_CODE.INVLDDATA);
    }

    let { slug } = data;
    if (!slug) {
      slug = generateSlug(data.title);
      const existing = await CreatorCard.findOne({ query: { slug, deleted: null } });
      if (existing) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let suffix = '';
        for (let i = 0; i < 6; i++) {
          suffix += chars[Math.floor(Math.random() * chars.length)];
        }
        slug = `${slug}-${suffix}`;
      }
    } else {
      const existing = await CreatorCard.findOne({ query: { slug, deleted: null } });
      if (existing) {
        throwAppError(Messages.SLUG_TAKEN, ERROR_CODE.SL02);
      }
    }

    const doc = {
      _id: ulid(),
      title: data.title,
      description: data.description || null,
      slug,
      creator_reference: data.creator_reference,
      links: data.links || [],
      service_rates: data.service_rates || null,
      status: data.status,
      access_type: data.access_type || 'public',
      access_code: data.access_type === 'private' ? data.access_code : null,
      deleted: null,
    };

    const saved = await CreatorCard.create(doc);

    response = formatCard(saved);
  } catch (error) {
    appLogger.errorX(error, 'create-card-error');
    throw error;
  }

  return response;
}

module.exports = { createCard, formatCard };
