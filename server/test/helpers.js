// Test defaults. Tests use stub providers and fake DNS, so no network,
// database or API keys are needed.
process.env.JWT_SECRET ||= 'test_secret_that_is_definitely_longer_than_32_chars';
process.env.LOG_LEVEL = 'error';
