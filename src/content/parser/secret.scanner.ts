import { SecretSeverity, StoredSecret } from '../../constants/secret_types';

interface SecretDetector {
  id: string;
  name: string;
  pattern: RegExp;
  severity: SecretSeverity;
  confidence: number;
  secretGroup?: number;
  validate?: (secret: string, context: string) => boolean;
}

const MAX_SECRET_LENGTH = 240;
const MIN_CONFIG_SECRET_LENGTH = 4;
const CONTEXT_RADIUS = 80;
const SCAN_YIELD_INTERVAL = 25;

function hasReasonableEntropy(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length < 16) {
    return false;
  }

  const counts = new Map<string, number>();
  for (const char of normalized) {
    counts.set(char, (counts.get(char) || 0) + 1);
  }

  let entropy = 0;
  counts.forEach((count) => {
    const probability = count / normalized.length;
    entropy -= probability * Math.log2(probability);
  });

  return entropy >= 3.25;
}

function looksLikePlaceholder(value: string): boolean {
  const lowered = value.toLowerCase();
  return [
    'example',
    'sample',
    'placeholder',
    'changeme',
    'your_',
    'your-',
    'dummy',
    'testtest',
    'xxxxxxxx',
    'aaaaaaaa',
    '00000000',
    '12345678',
  ].some((marker) => lowered.includes(marker));
}

function isLikelyToken(value: string): boolean {
  const secret = value.trim();
  return secret.length <= MAX_SECRET_LENGTH && !looksLikePlaceholder(secret) && hasReasonableEntropy(secret);
}

function looksLikeNonSecretConfigValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    'true',
    'false',
    'enabled',
    'disabled',
    'enable',
    'disable',
    'yes',
    'no',
    'null',
    'undefined',
    'production',
    'development',
    'staging',
    'test',
  ].includes(normalized);
}

function isPotentialConfigSecret(value: string): boolean {
  const secret = value.trim();

  return (
    secret.length >= MIN_CONFIG_SECRET_LENGTH &&
    secret.length <= MAX_SECRET_LENGTH &&
    !looksLikePlaceholder(secret) &&
    !looksLikeNonSecretConfigValue(secret) &&
    !/^https?:\/\//i.test(secret)
  );
}

function buildAssignmentPattern(names: string): RegExp {
  return new RegExp(
    String.raw`\b(?:${names})\b\s*(?:=|:|=>)\s*["'\`]?(?<secret>[A-Za-z0-9_./+=:@%$-]{16,${MAX_SECRET_LENGTH}})["'\`]?`,
    'gi'
  );
}

function buildConfigAssignmentPattern(names: string): RegExp {
  return new RegExp(
    String.raw`\b(?:${names})\b\s*(?:=|:|=>)\s*["'\`]?(?<secret>[^"'\x60,\r\n]{${MIN_CONFIG_SECRET_LENGTH},${MAX_SECRET_LENGTH}})["'\`]?`,
    'gi'
  );
}

function assignmentDetector(
  id: string,
  name: string,
  names: string,
  severity: SecretSeverity = 'high',
  confidence = 78
): SecretDetector {
  return {
    id,
    name,
    pattern: buildAssignmentPattern(names),
    severity,
    confidence,
    validate: (secret) => isLikelyToken(secret) && !/^https?:\/\//i.test(secret),
  };
}

const API_KEY_WORDS = String.raw`api(?:_|-)?key|access(?:_|-)?key|secret(?:_|-)?key`;
const API_TOKEN_WORDS = String.raw`api(?:_|-)?token|access(?:_|-)?token|auth(?:_|-)?token|bearer(?:_|-)?token|refresh(?:_|-)?token`;
const SECRET_WORDS = String.raw`client(?:_|-)?secret|consumer(?:_|-)?secret|app(?:_|-)?secret|signing(?:_|-)?secret|webhook(?:_|-)?secret|private(?:_|-)?key`;
const PUBLIC_CONFIG_PREFIXES = String.raw`next(?:_|-)?public|vite|react(?:_|-)?app|public`;
const PUBLIC_CONFIG_SECRET_WORDS = String.raw`api(?:_|-)?key|access(?:_|-)?key|secret(?:_|-)?key|site(?:_|-)?key|store(?:_|-)?key|public(?:_|-)?key|publishable(?:_|-)?key|token|access(?:_|-)?token|auth(?:_|-)?token|bearer(?:_|-)?token|refresh(?:_|-)?token|preview(?:_|-)?token|static(?:_|-)?token|client(?:_|-)?secret|consumer(?:_|-)?secret|app(?:_|-)?secret|user(?:_|-)?agent(?:_|-)?secret|validation(?:_|-)?secret|webhook(?:_|-)?secret|private(?:_|-)?key|client(?:_|-)?id|app(?:_|-)?id|application(?:_|-)?id|space(?:_|-)?id|list(?:_|-)?id|company(?:_|-)?id|account(?:_|-)?id|tenant(?:_|-)?id|subscription(?:_|-)?form(?:_|-)?(?:mobile|desktop|id)?|sms(?:_|-)?list(?:_|-)?id`;

const PROVIDER_ASSIGNMENT_DETECTORS: SecretDetector[] = [
  assignmentDetector('openai-assignment', 'OpenAI Secret', String.raw`openai(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 88),
  assignmentDetector('anthropic-assignment', 'Anthropic Secret', String.raw`anthropic(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 88),
  assignmentDetector('azure-assignment', 'Azure Secret', String.raw`azure(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|storage(?:_|-)?key|tenant(?:_|-)?secret)`, 'critical', 86),
  assignmentDetector('gcp-assignment', 'Google Cloud Secret', String.raw`(?:gcp|google(?:_|-)?cloud)(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 86),
  assignmentDetector('cloudflare-assignment', 'Cloudflare Secret', String.raw`cloudflare(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 86),
  assignmentDetector('digitalocean-assignment', 'DigitalOcean Secret', String.raw`(?:digitalocean|do)(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('linode-assignment', 'Linode Secret', String.raw`linode(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('heroku-assignment', 'Heroku Secret', String.raw`heroku(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('vercel-assignment', 'Vercel Secret', String.raw`vercel(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('netlify-assignment', 'Netlify Secret', String.raw`netlify(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('flyio-assignment', 'Fly.io Secret', String.raw`fly(?:_|-)?io(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 82),
  assignmentDetector('render-assignment', 'Render Secret', String.raw`render(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 82),
  assignmentDetector('railway-assignment', 'Railway Secret', String.raw`railway(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 82),
  assignmentDetector('supabase-assignment', 'Supabase Secret', String.raw`supabase(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|service(?:_|-)?role)`, 'critical', 84),
  assignmentDetector('firebase-assignment', 'Firebase Secret', String.raw`firebase(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|private(?:_|-)?key)`, 'high', 80),
  assignmentDetector('clerk-assignment', 'Clerk Secret', String.raw`clerk(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('auth0-assignment', 'Auth0 Secret', String.raw`auth0(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|client(?:_|-)?id)`, 'critical', 84),
  assignmentDetector('okta-assignment', 'Okta Secret', String.raw`okta(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('cognito-assignment', 'AWS Cognito Secret', String.raw`cognito(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 80),
  assignmentDetector('github-assignment', 'GitHub Secret', String.raw`github(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|pat|oauth(?:_|-)?token)`, 'critical', 86),
  assignmentDetector('gitlab-assignment', 'GitLab Secret', String.raw`gitlab(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|pat)`, 'critical', 86),
  assignmentDetector('bitbucket-assignment', 'Bitbucket Secret', String.raw`bitbucket(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|app(?:_|-)?password)`, 'critical', 84),
  assignmentDetector('atlassian-assignment', 'Atlassian Secret', String.raw`(?:atlassian|jira|confluence)(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('slack-assignment', 'Slack Secret', String.raw`slack(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|bot(?:_|-)?token|webhook)`, 'critical', 86),
  assignmentDetector('discord-assignment', 'Discord Secret', String.raw`discord(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|bot(?:_|-)?token|webhook)`, 'critical', 84),
  assignmentDetector('telegram-assignment', 'Telegram Secret', String.raw`telegram(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|bot(?:_|-)?token)`, 'critical', 84),
  assignmentDetector('twilio-assignment', 'Twilio Secret', String.raw`twilio(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|account(?:_|-)?sid|auth(?:_|-)?token)`, 'critical', 86),
  assignmentDetector('sendgrid-assignment', 'SendGrid Secret', String.raw`sendgrid(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 86),
  assignmentDetector('mailgun-assignment', 'Mailgun Secret', String.raw`mailgun(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('mailchimp-assignment', 'Mailchimp Secret', String.raw`mailchimp(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('postmark-assignment', 'Postmark Secret', String.raw`postmark(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|server(?:_|-)?token)`, 'high', 82),
  assignmentDetector('stripe-assignment', 'Stripe Secret', String.raw`stripe(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|restricted(?:_|-)?key)`, 'critical', 88),
  assignmentDetector('paypal-assignment', 'PayPal Secret', String.raw`paypal(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|client(?:_|-)?id)`, 'critical', 84),
  assignmentDetector('square-assignment', 'Square Secret', String.raw`square(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('razorpay-assignment', 'Razorpay Secret', String.raw`razorpay(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('plaid-assignment', 'Plaid Secret', String.raw`plaid(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('coinbase-assignment', 'Coinbase Secret', String.raw`coinbase(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('shopify-assignment', 'Shopify Secret', String.raw`shopify(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 86),
  assignmentDetector('stripe-webhook-assignment', 'Stripe Webhook Secret', String.raw`stripe(?:_|-)?webhook(?:_|-)?secret|webhook(?:_|-)?signing(?:_|-)?secret`, 'critical', 86),
  assignmentDetector('algolia-assignment', 'Algolia Secret', String.raw`algolia(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|admin(?:_|-)?key|search(?:_|-)?key)`, 'high', 82),
  assignmentDetector('mapbox-assignment', 'Mapbox Secret', String.raw`mapbox(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 82),
  assignmentDetector('contentful-assignment', 'Contentful Secret', String.raw`contentful(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 82),
  assignmentDetector('sanity-assignment', 'Sanity Secret', String.raw`sanity(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 82),
  assignmentDetector('cloudinary-assignment', 'Cloudinary Secret', String.raw`cloudinary(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|url)`, 'critical', 84),
  assignmentDetector('datadog-assignment', 'Datadog Secret', String.raw`datadog(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|app(?:_|-)?key)`, 'critical', 84),
  assignmentDetector('newrelic-assignment', 'New Relic Secret', String.raw`new(?:_|-)?relic(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|license(?:_|-)?key)`, 'critical', 84),
  assignmentDetector('sentry-assignment', 'Sentry Secret', String.raw`sentry(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|dsn|auth(?:_|-)?token)`, 'high', 80),
  assignmentDetector('grafana-assignment', 'Grafana Secret', String.raw`grafana(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|service(?:_|-)?account(?:_|-)?token)`, 'critical', 84),
  assignmentDetector('honeycomb-assignment', 'Honeycomb Secret', String.raw`honeycomb(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 82),
  assignmentDetector('snyk-assignment', 'Snyk Secret', String.raw`snyk(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('sonarqube-assignment', 'SonarQube Secret', String.raw`(?:sonar|sonarqube)(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('vault-assignment', 'HashiCorp Vault Secret', String.raw`(?:vault|hashicorp)(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|root(?:_|-)?token)`, 'critical', 86),
  assignmentDetector('terraform-assignment', 'Terraform Cloud Secret', String.raw`terraform(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|cloud(?:_|-)?token)`, 'critical', 84),
  assignmentDetector('pulumi-assignment', 'Pulumi Secret', String.raw`pulumi(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('docker-assignment', 'Docker Secret', String.raw`docker(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|hub(?:_|-)?token|pat)`, 'critical', 84),
  assignmentDetector('npm-assignment', 'npm Secret', String.raw`npm(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('pypi-assignment', 'PyPI Secret', String.raw`pypi(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('huggingface-assignment', 'Hugging Face Secret', String.raw`(?:huggingface|hugging(?:_|-)?face|hf)(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('replicate-assignment', 'Replicate Secret', String.raw`replicate(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('pinecone-assignment', 'Pinecone Secret', String.raw`pinecone(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('cohere-assignment', 'Cohere Secret', String.raw`cohere(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('mistral-assignment', 'Mistral Secret', String.raw`mistral(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('groq-assignment', 'Groq Secret', String.raw`groq(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('langsmith-assignment', 'LangSmith Secret', String.raw`langsmith(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('linear-assignment', 'Linear Secret', String.raw`linear(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('notion-assignment', 'Notion Secret', String.raw`notion(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|integration(?:_|-)?token)`, 'critical', 84),
  assignmentDetector('airtable-assignment', 'Airtable Secret', String.raw`airtable(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|pat)`, 'critical', 84),
  assignmentDetector('postman-assignment', 'Postman Secret', String.raw`postman(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('zapier-assignment', 'Zapier Secret', String.raw`zapier(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|webhook)`, 'high', 80),
  assignmentDetector('zapier-webhook-assignment', 'Zapier Webhook Secret', String.raw`hooks(?:_|-)?zapier(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 80),
  assignmentDetector('segment-assignment', 'Segment Secret', String.raw`segment(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|write(?:_|-)?key)`, 'high', 80),
  assignmentDetector('launchdarkly-assignment', 'LaunchDarkly Secret', String.raw`launch(?:_|-)?darkly(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|sdk(?:_|-)?key)`, 'high', 80),
  assignmentDetector('splitio-assignment', 'Split.io Secret', String.raw`split(?:_|-)?io(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|sdk(?:_|-)?key)`, 'high', 80),
  assignmentDetector('intercom-assignment', 'Intercom Secret', String.raw`intercom(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 80),
  assignmentDetector('hubspot-assignment', 'HubSpot Secret', String.raw`hubspot(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|private(?:_|-)?app(?:_|-)?token)`, 'critical', 84),
  assignmentDetector('zendesk-assignment', 'Zendesk Secret', String.raw`zendesk(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('freshdesk-assignment', 'Freshdesk Secret', String.raw`freshdesk(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 80),
  assignmentDetector('dropbox-assignment', 'Dropbox Secret', String.raw`dropbox(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('box-assignment', 'Box Secret', String.raw`box(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'high', 80),
  assignmentDetector('microsoft-graph-assignment', 'Microsoft Graph Secret', String.raw`(?:microsoft(?:_|-)?graph|ms(?:_|-)?graph)(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('zoom-assignment', 'Zoom Secret', String.raw`zoom(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|jwt)`, 'critical', 84),
  assignmentDetector('pagerduty-assignment', 'PagerDuty Secret', String.raw`pagerduty(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|routing(?:_|-)?key)`, 'critical', 84),
  assignmentDetector('opsgenie-assignment', 'Opsgenie Secret', String.raw`opsgenie(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('databricks-assignment', 'Databricks Secret', String.raw`databricks(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS})`, 'critical', 84),
  assignmentDetector('snowflake-assignment', 'Snowflake Secret', String.raw`snowflake(?:_|-)?(?:${API_KEY_WORDS}|${API_TOKEN_WORDS}|${SECRET_WORDS}|private(?:_|-)?key|password)`, 'critical', 84),
];

interface ProviderDescriptor {
  id: string;
  name: string;
  pattern: string;
  severity?: SecretSeverity;
  confidence?: number;
}

interface AssignmentFamily {
  id: string;
  name: string;
  pattern: string;
  severity: SecretSeverity;
  confidence: number;
}

const BROAD_ASSIGNMENT_FAMILIES: AssignmentFamily[] = [
  { id: 'api-key', name: 'API Key', pattern: API_KEY_WORDS, severity: 'critical', confidence: 82 },
  { id: 'token', name: 'Token', pattern: API_TOKEN_WORDS, severity: 'critical', confidence: 82 },
  { id: 'secret', name: 'Secret', pattern: SECRET_WORDS, severity: 'critical', confidence: 82 },
  { id: 'password', name: 'Password', pattern: String.raw`password|passwd|pwd|passphrase`, severity: 'critical', confidence: 80 },
  { id: 'credential', name: 'Credential', pattern: String.raw`credential|credentials|creds`, severity: 'high', confidence: 78 },
  { id: 'webhook', name: 'Webhook Secret', pattern: String.raw`webhook(?:_|-)?(?:url|secret|token|key)|callback(?:_|-)?secret`, severity: 'high', confidence: 78 },
  { id: 'signing', name: 'Signing Secret', pattern: String.raw`signing(?:_|-)?(?:secret|key)|signature(?:_|-)?secret|hmac(?:_|-)?key`, severity: 'critical', confidence: 80 },
  { id: 'connection', name: 'Connection Secret', pattern: String.raw`connection(?:_|-)?(?:string|url|secret)|dsn|database(?:_|-)?url`, severity: 'critical', confidence: 78 },
];

const BROAD_PROVIDER_CATALOG: ProviderDescriptor[] = [
  { id: '1password', name: '1Password', pattern: String.raw`1password|op` },
  { id: 'ably', name: 'Ably', pattern: String.raw`ably` },
  { id: 'adyen', name: 'Adyen', pattern: String.raw`adyen` },
  { id: 'agora', name: 'Agora', pattern: String.raw`agora` },
  { id: 'airbrake', name: 'Airbrake', pattern: String.raw`airbrake` },
  { id: 'airtable', name: 'Airtable', pattern: String.raw`airtable` },
  { id: 'algolia', name: 'Algolia', pattern: String.raw`algolia` },
  { id: 'alibaba-cloud', name: 'Alibaba Cloud', pattern: String.raw`alibaba(?:_|-)?cloud|aliyun` },
  { id: 'amplitude', name: 'Amplitude', pattern: String.raw`amplitude` },
  { id: 'anthropic', name: 'Anthropic', pattern: String.raw`anthropic|claude` },
  { id: 'apideck', name: 'Apideck', pattern: String.raw`apideck` },
  { id: 'apify', name: 'Apify', pattern: String.raw`apify` },
  { id: 'appcenter', name: 'App Center', pattern: String.raw`app(?:_|-)?center` },
  { id: 'appdynamics', name: 'AppDynamics', pattern: String.raw`appdynamics` },
  { id: 'apple', name: 'Apple', pattern: String.raw`apple|app(?:_|-)?store(?:_|-)?connect` },
  { id: 'asana', name: 'Asana', pattern: String.raw`asana` },
  { id: 'atlassian', name: 'Atlassian', pattern: String.raw`atlassian|jira|confluence` },
  { id: 'auth0', name: 'Auth0', pattern: String.raw`auth0` },
  { id: 'aws', name: 'AWS', pattern: String.raw`aws|amazon(?:_|-)?web(?:_|-)?services` },
  { id: 'azure', name: 'Azure', pattern: String.raw`azure|microsoft(?:_|-)?azure` },
  { id: 'bamboohr', name: 'BambooHR', pattern: String.raw`bamboohr` },
  { id: 'bitbucket', name: 'Bitbucket', pattern: String.raw`bitbucket` },
  { id: 'bitly', name: 'Bitly', pattern: String.raw`bitly` },
  { id: 'box', name: 'Box', pattern: String.raw`box` },
  { id: 'braze', name: 'Braze', pattern: String.raw`braze` },
  { id: 'brevo', name: 'Brevo', pattern: String.raw`brevo|sendinblue` },
  { id: 'browserstack', name: 'BrowserStack', pattern: String.raw`browserstack` },
  { id: 'buildkite', name: 'Buildkite', pattern: String.raw`buildkite` },
  { id: 'calendly', name: 'Calendly', pattern: String.raw`calendly` },
  { id: 'circleci', name: 'CircleCI', pattern: String.raw`circleci|circle(?:_|-)?ci` },
  { id: 'clerk', name: 'Clerk', pattern: String.raw`clerk` },
  { id: 'clickhouse', name: 'ClickHouse', pattern: String.raw`clickhouse` },
  { id: 'clickup', name: 'ClickUp', pattern: String.raw`clickup` },
  { id: 'cloudamqp', name: 'CloudAMQP', pattern: String.raw`cloudamqp` },
  { id: 'cloudflare', name: 'Cloudflare', pattern: String.raw`cloudflare` },
  { id: 'cloudinary', name: 'Cloudinary', pattern: String.raw`cloudinary` },
  { id: 'cohere', name: 'Cohere', pattern: String.raw`cohere` },
  { id: 'coinbase', name: 'Coinbase', pattern: String.raw`coinbase` },
  { id: 'contentful', name: 'Contentful', pattern: String.raw`contentful` },
  { id: 'courier', name: 'Courier', pattern: String.raw`courier` },
  { id: 'databricks', name: 'Databricks', pattern: String.raw`databricks` },
  { id: 'datadog', name: 'Datadog', pattern: String.raw`datadog` },
  { id: 'deepgram', name: 'Deepgram', pattern: String.raw`deepgram` },
  { id: 'digitalocean', name: 'DigitalOcean', pattern: String.raw`digitalocean|do` },
  { id: 'discord', name: 'Discord', pattern: String.raw`discord` },
  { id: 'docker', name: 'Docker', pattern: String.raw`docker|dockerhub` },
  { id: 'doppler', name: 'Doppler', pattern: String.raw`doppler` },
  { id: 'dropbox', name: 'Dropbox', pattern: String.raw`dropbox` },
  { id: 'elastic', name: 'Elastic', pattern: String.raw`elastic|elasticsearch|elasticcloud` },
  { id: 'elevenlabs', name: 'ElevenLabs', pattern: String.raw`elevenlabs|eleven(?:_|-)?labs` },
  { id: 'fastly', name: 'Fastly', pattern: String.raw`fastly` },
  { id: 'figma', name: 'Figma', pattern: String.raw`figma` },
  { id: 'firebase', name: 'Firebase', pattern: String.raw`firebase` },
  { id: 'flyio', name: 'Fly.io', pattern: String.raw`fly(?:_|-)?io|flyio` },
  { id: 'freshdesk', name: 'Freshdesk', pattern: String.raw`freshdesk` },
  { id: 'gcp', name: 'Google Cloud', pattern: String.raw`gcp|google(?:_|-)?cloud|google` },
  { id: 'ghost', name: 'Ghost', pattern: String.raw`ghost` },
  { id: 'github', name: 'GitHub', pattern: String.raw`github` },
  { id: 'gitlab', name: 'GitLab', pattern: String.raw`gitlab` },
  { id: 'gocardless', name: 'GoCardless', pattern: String.raw`gocardless` },
  { id: 'grafana', name: 'Grafana', pattern: String.raw`grafana` },
  { id: 'groq', name: 'Groq', pattern: String.raw`groq` },
  { id: 'hashicorp', name: 'HashiCorp', pattern: String.raw`hashicorp|vault|terraform` },
  { id: 'heroku', name: 'Heroku', pattern: String.raw`heroku` },
  { id: 'honeybadger', name: 'Honeybadger', pattern: String.raw`honeybadger` },
  { id: 'honeycomb', name: 'Honeycomb', pattern: String.raw`honeycomb` },
  { id: 'hubspot', name: 'HubSpot', pattern: String.raw`hubspot` },
  { id: 'huggingface', name: 'Hugging Face', pattern: String.raw`huggingface|hugging(?:_|-)?face|hf` },
  { id: 'infura', name: 'Infura', pattern: String.raw`infura` },
  { id: 'influxdb', name: 'InfluxDB', pattern: String.raw`influxdb|influx` },
  { id: 'intercom', name: 'Intercom', pattern: String.raw`intercom` },
  { id: 'jenkins', name: 'Jenkins', pattern: String.raw`jenkins` },
  { id: 'knock', name: 'Knock', pattern: String.raw`knock` },
  { id: 'launchdarkly', name: 'LaunchDarkly', pattern: String.raw`launchdarkly|launch(?:_|-)?darkly` },
  { id: 'linear', name: 'Linear', pattern: String.raw`linear` },
  { id: 'linode', name: 'Linode', pattern: String.raw`linode` },
  { id: 'lob', name: 'Lob', pattern: String.raw`lob` },
  { id: 'logdna', name: 'LogDNA', pattern: String.raw`logdna` },
  { id: 'mailchimp', name: 'Mailchimp', pattern: String.raw`mailchimp` },
  { id: 'mailgun', name: 'Mailgun', pattern: String.raw`mailgun` },
  { id: 'mapbox', name: 'Mapbox', pattern: String.raw`mapbox` },
  { id: 'mattermost', name: 'Mattermost', pattern: String.raw`mattermost` },
  { id: 'messagebird', name: 'MessageBird', pattern: String.raw`messagebird` },
  { id: 'mistral', name: 'Mistral', pattern: String.raw`mistral` },
  { id: 'mixpanel', name: 'Mixpanel', pattern: String.raw`mixpanel` },
  { id: 'mongodb', name: 'MongoDB', pattern: String.raw`mongodb|mongo` },
  { id: 'neon', name: 'Neon', pattern: String.raw`neon` },
  { id: 'netlify', name: 'Netlify', pattern: String.raw`netlify` },
  { id: 'newrelic', name: 'New Relic', pattern: String.raw`newrelic|new(?:_|-)?relic` },
  { id: 'ngrok', name: 'ngrok', pattern: String.raw`ngrok` },
  { id: 'notion', name: 'Notion', pattern: String.raw`notion` },
  { id: 'npm', name: 'npm', pattern: String.raw`npm` },
  { id: 'okta', name: 'Okta', pattern: String.raw`okta` },
  { id: 'oneSignal', name: 'OneSignal', pattern: String.raw`onesignal|one(?:_|-)?signal` },
  { id: 'openai', name: 'OpenAI', pattern: String.raw`openai` },
  { id: 'opsgenie', name: 'Opsgenie', pattern: String.raw`opsgenie` },
  { id: 'oracle-cloud', name: 'Oracle Cloud', pattern: String.raw`oracle(?:_|-)?cloud|oci` },
  { id: 'pagerduty', name: 'PagerDuty', pattern: String.raw`pagerduty` },
  { id: 'paypal', name: 'PayPal', pattern: String.raw`paypal` },
  { id: 'pinecone', name: 'Pinecone', pattern: String.raw`pinecone` },
  { id: 'plaid', name: 'Plaid', pattern: String.raw`plaid` },
  { id: 'planetscale', name: 'PlanetScale', pattern: String.raw`planetscale|planet(?:_|-)?scale` },
  { id: 'posthog', name: 'PostHog', pattern: String.raw`posthog` },
  { id: 'postman', name: 'Postman', pattern: String.raw`postman` },
  { id: 'postmark', name: 'Postmark', pattern: String.raw`postmark` },
  { id: 'pusher', name: 'Pusher', pattern: String.raw`pusher` },
  { id: 'pypi', name: 'PyPI', pattern: String.raw`pypi` },
  { id: 'railway', name: 'Railway', pattern: String.raw`railway` },
  { id: 'rapidapi', name: 'RapidAPI', pattern: String.raw`rapidapi|rapid(?:_|-)?api` },
  { id: 'razorpay', name: 'Razorpay', pattern: String.raw`razorpay` },
  { id: 'redis', name: 'Redis', pattern: String.raw`redis|upstash` },
  { id: 'render', name: 'Render', pattern: String.raw`render` },
  { id: 'replicate', name: 'Replicate', pattern: String.raw`replicate` },
  { id: 'rollbar', name: 'Rollbar', pattern: String.raw`rollbar` },
  { id: 'salesforce', name: 'Salesforce', pattern: String.raw`salesforce` },
  { id: 'sanity', name: 'Sanity', pattern: String.raw`sanity` },
  { id: 'saucelabs', name: 'Sauce Labs', pattern: String.raw`saucelabs|sauce(?:_|-)?labs` },
  { id: 'segment', name: 'Segment', pattern: String.raw`segment` },
  { id: 'sendbird', name: 'Sendbird', pattern: String.raw`sendbird` },
  { id: 'sendgrid', name: 'SendGrid', pattern: String.raw`sendgrid` },
  { id: 'sentry', name: 'Sentry', pattern: String.raw`sentry` },
  { id: 'shippo', name: 'Shippo', pattern: String.raw`shippo` },
  { id: 'shopify', name: 'Shopify', pattern: String.raw`shopify` },
  { id: 'shortcut', name: 'Shortcut', pattern: String.raw`shortcut|clubhouse` },
  { id: 'slack', name: 'Slack', pattern: String.raw`slack` },
  { id: 'snowflake', name: 'Snowflake', pattern: String.raw`snowflake` },
  { id: 'sonarqube', name: 'SonarQube', pattern: String.raw`sonar|sonarqube` },
  { id: 'splitio', name: 'Split.io', pattern: String.raw`split(?:_|-)?io|splitio` },
  { id: 'square', name: 'Square', pattern: String.raw`square` },
  { id: 'stripe', name: 'Stripe', pattern: String.raw`stripe` },
  { id: 'supabase', name: 'Supabase', pattern: String.raw`supabase` },
  { id: 'synctera', name: 'Synctera', pattern: String.raw`synctera` },
  { id: 'telegram', name: 'Telegram', pattern: String.raw`telegram` },
  { id: 'temporal', name: 'Temporal', pattern: String.raw`temporal` },
  { id: 'travisci', name: 'Travis CI', pattern: String.raw`travis(?:_|-)?ci|travisci` },
  { id: 'trello', name: 'Trello', pattern: String.raw`trello` },
  { id: 'twilio', name: 'Twilio', pattern: String.raw`twilio` },
  { id: 'typeform', name: 'Typeform', pattern: String.raw`typeform` },
  { id: 'vercel', name: 'Vercel', pattern: String.raw`vercel` },
  { id: 'vonage', name: 'Vonage', pattern: String.raw`vonage|nexmo` },
  { id: 'webflow', name: 'Webflow', pattern: String.raw`webflow` },
  { id: 'workos', name: 'WorkOS', pattern: String.raw`workos` },
  { id: 'xai', name: 'xAI', pattern: String.raw`xai|grok` },
  { id: 'zendesk', name: 'Zendesk', pattern: String.raw`zendesk` },
  { id: 'zoom', name: 'Zoom', pattern: String.raw`zoom` },
  { id: 'zuplo', name: 'Zuplo', pattern: String.raw`zuplo` },
];

const PROVIDER_CONTEXTS: ProviderDescriptor[] = [
  { id: 'cloud', name: 'Cloud', pattern: String.raw`cloud` },
  { id: 'admin', name: 'Admin', pattern: String.raw`admin` },
  { id: 'app', name: 'App', pattern: String.raw`app|application` },
  { id: 'service', name: 'Service', pattern: String.raw`service` },
  { id: 'sdk', name: 'SDK', pattern: String.raw`sdk` },
  { id: 'webhook', name: 'Webhook', pattern: String.raw`webhook|hook` },
  { id: 'integration', name: 'Integration', pattern: String.raw`integration|connector` },
];

function createContextualProviderCatalog(): ProviderDescriptor[] {
  return BROAD_PROVIDER_CATALOG.flatMap((provider) => {
    return PROVIDER_CONTEXTS.map((context) => ({
      id: `${provider.id}-${context.id}`,
      name: `${provider.name} ${context.name}`,
      pattern: String.raw`(?:${provider.pattern})(?:_|-)?(?:${context.pattern})|(?:${context.pattern})(?:_|-)?(?:${provider.pattern})`,
      severity: provider.severity,
      confidence: provider.confidence,
    }));
  });
}

function getUniqueProviderCatalog(): ProviderDescriptor[] {
  const byId = new Map<string, ProviderDescriptor>();

  [...BROAD_PROVIDER_CATALOG, ...createContextualProviderCatalog()].forEach((provider) => {
    if (!byId.has(provider.id)) {
      byId.set(provider.id, provider);
    }
  });

  return Array.from(byId.values());
}

const ALL_BROAD_PROVIDER_CATALOG = getUniqueProviderCatalog();

function createBroadProviderAssignmentDetectors(): SecretDetector[] {
  return ALL_BROAD_PROVIDER_CATALOG.flatMap((provider) => {
    return BROAD_ASSIGNMENT_FAMILIES.map((family) => {
      const names = String.raw`(?:${provider.pattern})(?:_|-)?(?:${family.pattern})|(?:${family.pattern})(?:_|-)?(?:${provider.pattern})`;
      return assignmentDetector(
        `${provider.id}-${family.id}`,
        `${provider.name} ${family.name}`,
        names,
        provider.severity || family.severity,
        provider.confidence || family.confidence
      );
    });
  });
}

const BROAD_PROVIDER_ASSIGNMENT_DETECTORS = createBroadProviderAssignmentDetectors();

const DETECTORS: SecretDetector[] = [
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    pattern: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA)[A-Z0-9]{16}\b/g,
    severity: 'critical',
    confidence: 98,
  },
  {
    id: 'aws-secret-key-assignment',
    name: 'AWS Secret Access Key',
    pattern: buildAssignmentPattern(String.raw`aws(?:_|-)?secret(?:_|-)?access(?:_|-)?key|aws(?:_|-)?secret|secret(?:_|-)?access(?:_|-)?key`),
    severity: 'critical',
    confidence: 88,
    validate: isLikelyToken,
  },
  {
    id: 'google-api-key',
    name: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    severity: 'high',
    confidence: 95,
  },
  {
    id: 'google-oauth-client-secret',
    name: 'Google OAuth Client Secret',
    pattern: /\bGOCSPX-[0-9A-Za-z_-]{28,64}\b/g,
    severity: 'high',
    confidence: 95,
  },
  {
    id: 'github-token',
    name: 'GitHub Token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b/g,
    severity: 'critical',
    confidence: 98,
  },
  {
    id: 'github-fine-grained-token',
    name: 'GitHub Fine-Grained Token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59}\b/g,
    severity: 'critical',
    confidence: 98,
  },
  {
    id: 'gitlab-token',
    name: 'GitLab Personal Access Token',
    pattern: /\bglpat-[A-Za-z0-9_-]{20,64}\b/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'slack-token',
    name: 'Slack Token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,255}\b/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'slack-webhook',
    name: 'Slack Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,12}\/B[A-Z0-9]{8,12}\/[A-Za-z0-9]{20,32}/g,
    severity: 'critical',
    confidence: 98,
  },
  {
    id: 'stripe-secret-key',
    name: 'Stripe Secret Key',
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,99}\b/g,
    severity: 'critical',
    confidence: 97,
  },
  {
    id: 'stripe-publishable-key',
    name: 'Stripe Publishable Key',
    pattern: /\bpk_(?:live|test)_[A-Za-z0-9]{24,99}\b/g,
    severity: 'medium',
    confidence: 88,
  },
  {
    id: 'sendgrid-api-key',
    name: 'SendGrid API Key',
    pattern: /\bSG\.[A-Za-z0-9_-]{20,32}\.[A-Za-z0-9_-]{20,96}\b/g,
    severity: 'critical',
    confidence: 98,
  },
  {
    id: 'mailgun-api-key',
    name: 'Mailgun API Key',
    pattern: /\bkey-[0-9A-Za-z]{32}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'twilio-api-key',
    name: 'Twilio API Key',
    pattern: /\bSK[0-9a-fA-F]{32}\b/g,
    severity: 'critical',
    confidence: 95,
  },
  {
    id: 'square-access-token',
    name: 'Square Access Token',
    pattern: /\bsq0atp-[0-9A-Za-z_-]{22,64}\b/g,
    severity: 'critical',
    confidence: 95,
  },
  {
    id: 'square-oauth-secret',
    name: 'Square OAuth Secret',
    pattern: /\bsq0csp-[0-9A-Za-z_-]{22,64}\b/g,
    severity: 'critical',
    confidence: 95,
  },
  {
    id: 'shopify-token',
    name: 'Shopify Token',
    pattern: /\bshp(?:at|ca|ss|ua)_[A-Za-z0-9]{32}\b/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'telegram-bot-token',
    name: 'Telegram Bot Token',
    pattern: /\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'discord-webhook',
    name: 'Discord Webhook URL',
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]{17,20}\/[A-Za-z0-9_-]{60,100}/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'discord-bot-token',
    name: 'Discord Bot Token',
    pattern: /\b[MN][A-Za-z0-9_-]{23}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,39}\b/g,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'openai-api-key',
    name: 'OpenAI API Key',
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,240}\b/g,
    severity: 'critical',
    confidence: 95,
  },
  {
    id: 'anthropic-api-key',
    name: 'Anthropic API Key',
    pattern: /\bsk-ant-(?:api|admin)[0-9]{2}-[A-Za-z0-9_-]{20,240}\b/g,
    severity: 'critical',
    confidence: 95,
  },
  {
    id: 'groq-api-key',
    name: 'Groq API Key',
    pattern: /\bgsk_[A-Za-z0-9]{20,120}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'huggingface-token',
    name: 'Hugging Face Token',
    pattern: /\bhf_[A-Za-z0-9]{30,120}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'replicate-api-token',
    name: 'Replicate API Token',
    pattern: /\br8_[A-Za-z0-9]{30,120}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'langsmith-api-key',
    name: 'LangSmith API Key',
    pattern: /\blsv2_[A-Za-z0-9_]{20,160}\b/g,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'npm-token',
    name: 'npm Token',
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'pypi-token',
    name: 'PyPI Token',
    pattern: /\bpypi-[A-Za-z0-9_-]{30,240}\b/g,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'docker-pat',
    name: 'Docker Personal Access Token',
    pattern: /\bdckr_pat_[A-Za-z0-9_-]{20,160}\b/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'digitalocean-token',
    name: 'DigitalOcean Token',
    pattern: /\bdop_v1_[a-f0-9]{64}\b/gi,
    severity: 'critical',
    confidence: 97,
  },
  {
    id: 'netlify-token',
    name: 'Netlify Token',
    pattern: /\bnfp_[A-Za-z0-9]{40,120}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'vercel-token',
    name: 'Vercel Token',
    pattern: /\bvercel_[A-Za-z0-9]{20,160}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'linear-api-key',
    name: 'Linear API Key',
    pattern: /\blin_api_[A-Za-z0-9]{20,120}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'notion-token',
    name: 'Notion Integration Token',
    pattern: /\bsecret_[A-Za-z0-9]{30,80}\b/g,
    severity: 'critical',
    confidence: 88,
  },
  {
    id: 'airtable-pat',
    name: 'Airtable Personal Access Token',
    pattern: /\bpat[A-Za-z0-9]{14}\.[A-Za-z0-9]{40,120}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'airtable-legacy-key',
    name: 'Airtable Legacy API Key',
    pattern: /\bkey[A-Za-z0-9]{14}\b/g,
    severity: 'high',
    confidence: 88,
  },
  {
    id: 'postman-api-key',
    name: 'Postman API Key',
    pattern: /\bPMAK-[a-f0-9]{24}-[a-f0-9]{34}\b/gi,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'hubspot-private-app-token',
    name: 'HubSpot Private App Token',
    pattern: /\bpat-[a-z0-9]{2,8}-[A-Za-z0-9-]{30,120}\b/g,
    severity: 'critical',
    confidence: 90,
  },
  {
    id: 'mailchimp-api-key',
    name: 'Mailchimp API Key',
    pattern: /\b[0-9a-f]{32}-us[0-9]{1,2}\b/gi,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'mapbox-secret-key',
    name: 'Mapbox Secret Key',
    pattern: /\bsk\.[A-Za-z0-9._-]{40,240}\b/g,
    severity: 'critical',
    confidence: 90,
  },
  {
    id: 'mapbox-public-key',
    name: 'Mapbox Public Key',
    pattern: /\bpk\.[A-Za-z0-9._-]{40,240}\b/g,
    severity: 'medium',
    confidence: 82,
  },
  {
    id: 'clerk-secret-key',
    name: 'Clerk Secret Key',
    pattern: /\bsk_(?:test|live)_[A-Za-z0-9]{20,120}\b/g,
    severity: 'critical',
    confidence: 88,
  },
  {
    id: 'clerk-publishable-key',
    name: 'Clerk Publishable Key',
    pattern: /\bpk_(?:test|live)_[A-Za-z0-9]{20,120}\b/g,
    severity: 'medium',
    confidence: 82,
  },
  {
    id: 'cloudinary-url',
    name: 'Cloudinary URL With Secret',
    pattern: /\bcloudinary:\/\/[A-Za-z0-9_-]{6,64}:[A-Za-z0-9_-]{12,128}@[A-Za-z0-9_-]{2,128}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'azure-storage-connection-string',
    name: 'Azure Storage Connection String',
    pattern: /\bDefaultEndpointsProtocol=https?;AccountName=[A-Za-z0-9_-]{3,64};AccountKey=[A-Za-z0-9+/=]{40,120}(?:;EndpointSuffix=[A-Za-z0-9.-]+)?/g,
    severity: 'critical',
    confidence: 97,
  },
  {
    id: 'azure-sas-token',
    name: 'Azure SAS Token',
    pattern: /\bsv=\d{4}-\d{2}-\d{2}&(?:ss|sr)=[A-Za-z]+&[A-Za-z0-9=&%_.:+/-]{20,400}&sig=[A-Za-z0-9%+/=]{20,160}/g,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'terraform-cloud-token',
    name: 'Terraform Cloud Token',
    pattern: /\batlasv1\.[A-Za-z0-9_-]{60,240}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'vault-token',
    name: 'HashiCorp Vault Token',
    pattern: /\b(?:hvs|hvb)\.[A-Za-z0-9_-]{20,160}\b/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'grafana-service-account-token',
    name: 'Grafana Service Account Token',
    pattern: /\bglsa_[A-Za-z0-9_-]{20,240}\b/g,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'grafana-cloud-token',
    name: 'Grafana Cloud Token',
    pattern: /\bglc_[A-Za-z0-9+/=]{20,240}\b/g,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'sonarqube-token',
    name: 'SonarQube Token',
    pattern: /\bsqp_[a-f0-9]{40}\b/gi,
    severity: 'critical',
    confidence: 94,
  },
  {
    id: 'sentry-token',
    name: 'Sentry Token',
    pattern: /\bsntrys_[A-Za-z0-9_-]{20,240}\b/g,
    severity: 'critical',
    confidence: 90,
  },
  {
    id: 'dropbox-token',
    name: 'Dropbox Token',
    pattern: /\bsl\.[A-Za-z0-9_-]{80,240}\b/g,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'intercom-token',
    name: 'Intercom Access Token',
    pattern: /\bdG9rOj[A-Za-z0-9+/=_-]{20,200}\b/g,
    severity: 'critical',
    confidence: 86,
  },
  {
    id: 'oauth-access-token',
    name: 'OAuth Access Token',
    pattern: /\bya29\.[A-Za-z0-9_-]{20,240}\b/g,
    severity: 'critical',
    confidence: 90,
  },
  {
    id: 'google-service-account-json',
    name: 'Google Service Account JSON',
    pattern: /"type"\s*:\s*"service_account"[\s\S]{20,2000}?"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----[\s\S]{40,5000}?-----END PRIVATE KEY-----\\n"/g,
    severity: 'critical',
    confidence: 99,
  },
  {
    id: 'pem-certificate-key-pair',
    name: 'PEM Key Material',
    pattern: /-----BEGIN (?:ENCRYPTED |RSA |DSA |EC |OPENSSH |PGP )?(?:PRIVATE KEY|CERTIFICATE REQUEST)-----[\s\S]{40,6000}?-----END (?:ENCRYPTED |RSA |DSA |EC |OPENSSH |PGP )?(?:PRIVATE KEY|CERTIFICATE REQUEST)-----/g,
    severity: 'critical',
    confidence: 96,
  },
  {
    id: 'firebase-api-key',
    name: 'Firebase API Key',
    pattern: buildAssignmentPattern(String.raw`firebase(?:_|-)?api(?:_|-)?key|apiKey`),
    severity: 'medium',
    confidence: 75,
    validate: (secret, context) => context.toLowerCase().includes('firebase') && isLikelyToken(secret),
  },
  {
    id: 'jwt-token',
    name: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'high',
    confidence: 90,
  },
  {
    id: 'private-key',
    name: 'Private Key Block',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]{40,6000}?-----END (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    severity: 'critical',
    confidence: 99,
  },
  {
    id: 'basic-auth-url',
    name: 'URL With Embedded Credentials',
    pattern: /\bhttps?:\/\/[A-Za-z0-9._~%+-]{2,64}:[^@\s"'<>]{6,128}@[^\s"'<>]+/g,
    severity: 'high',
    confidence: 86,
  },
  {
    id: 'database-url',
    name: 'Database Connection String',
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[A-Za-z0-9._~%+-]{2,64}:[^@\s"'<>]{6,128}@[^\s"'<>]+/g,
    severity: 'critical',
    confidence: 92,
  },
  {
    id: 'public-config-secret-assignment',
    name: 'Public Config Secret',
    pattern: buildConfigAssignmentPattern(
      String.raw`(?:${PUBLIC_CONFIG_PREFIXES})(?:_|-)?(?:[a-z0-9]+(?:_|-)?){0,8}(?:${PUBLIC_CONFIG_SECRET_WORDS})|(?:${PUBLIC_CONFIG_SECRET_WORDS})`
    ),
    severity: 'high',
    confidence: 72,
    validate: isPotentialConfigSecret,
  },
  ...PROVIDER_ASSIGNMENT_DETECTORS,
  ...BROAD_PROVIDER_ASSIGNMENT_DETECTORS,
  {
    id: 'generic-secret-assignment',
    name: 'Generic Secret Assignment',
    pattern: buildAssignmentPattern(
      String.raw`api(?:_|-)?key|access(?:_|-)?token|auth(?:_|-)?token|bearer(?:_|-)?token|client(?:_|-)?secret|refresh(?:_|-)?token|secret(?:_|-)?key|secret|password|passwd|pwd`
    ),
    severity: 'high',
    confidence: 68,
    validate: (secret) => isLikelyToken(secret) && !/^https?:\/\//i.test(secret),
  },
];

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function cleanContext(context: string): string {
  return context.replace(/\s+/g, ' ').trim();
}

function getContext(content: string, index: number, length: number): string {
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(content.length, index + length + CONTEXT_RADIUS);
  return cleanContext(content.slice(start, end));
}

function getSecretFromMatch(match: RegExpExecArray, detector: SecretDetector): string {
  if (match.groups?.secret) {
    return match.groups.secret;
  }

  if (detector.secretGroup !== undefined && match[detector.secretGroup]) {
    return match[detector.secretGroup];
  }

  return match[0];
}

function severityWeight(severity: SecretSeverity): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

function isBetterFinding(candidate: StoredSecret, existing: StoredSecret): boolean {
  const candidateSeverity = severityWeight(candidate.severity);
  const existingSeverity = severityWeight(existing.severity);

  if (candidateSeverity !== existingSeverity) {
    return candidateSeverity > existingSeverity;
  }

  return candidate.confidence > existing.confidence;
}

export class SecretScanner {
  static scan(content: string): StoredSecret[] {
    return this.scanWithCancellation(content, () => false);
  }

  static async scanAsync(content: string, shouldStop: () => boolean): Promise<StoredSecret[]> {
    const findings = new Map<string, StoredSecret>();

    for (const detector of DETECTORS) {
      if (shouldStop()) {
        break;
      }

      await this.scanDetector(content, detector, findings, shouldStop);

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return Array.from(findings.values());
  }

  private static scanWithCancellation(content: string, shouldStop: () => boolean): StoredSecret[] {
    const findings = new Map<string, StoredSecret>();

    DETECTORS.forEach((detector) => {
      if (!shouldStop()) {
        this.scanDetectorSync(content, detector, findings, shouldStop);
      }
    });

    return Array.from(findings.values());
  }

  private static async scanDetector(
    content: string,
    detector: SecretDetector,
    findings: Map<string, StoredSecret>,
    shouldStop: () => boolean
  ): Promise<void> {
    detector.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    let matchCount = 0;

    while (!shouldStop() && (match = detector.pattern.exec(content)) !== null) {
      matchCount += 1;
      if (match[0].length === 0) {
        detector.pattern.lastIndex += 1;
      }

      if (matchCount % SCAN_YIELD_INTERVAL === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const secret = getSecretFromMatch(match, detector).trim();
      const context = getContext(content, match.index, match[0].length);

      if (!secret || looksLikePlaceholder(secret) || detector.validate?.(secret, context) === false) {
        continue;
      }

      const candidate: StoredSecret = {
        detectorId: detector.id,
        detectorName: detector.name,
        secret,
        context,
        lineNumber: getLineNumber(content, match.index),
        confidence: detector.confidence,
        severity: detector.severity,
        firstSeenAt: new Date().toISOString(),
      };
      const existing = findings.get(secret);

      if (!existing || isBetterFinding(candidate, existing)) {
        findings.set(secret, candidate);
      }
    }
  }

  private static scanDetectorSync(
    content: string,
    detector: SecretDetector,
    findings: Map<string, StoredSecret>,
    shouldStop: () => boolean
  ): void {
    detector.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while (!shouldStop() && (match = detector.pattern.exec(content)) !== null) {
      if (match[0].length === 0) {
        detector.pattern.lastIndex += 1;
      }

      const secret = getSecretFromMatch(match, detector).trim();
      const context = getContext(content, match.index, match[0].length);

      if (!secret || looksLikePlaceholder(secret) || detector.validate?.(secret, context) === false) {
        continue;
      }

      const candidate: StoredSecret = {
        detectorId: detector.id,
        detectorName: detector.name,
        secret,
        context,
        lineNumber: getLineNumber(content, match.index),
        confidence: detector.confidence,
        severity: detector.severity,
        firstSeenAt: new Date().toISOString(),
      };
      const existing = findings.get(secret);

      if (!existing || isBetterFinding(candidate, existing)) {
        findings.set(secret, candidate);
      }
    }
  }
}
