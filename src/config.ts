export const domainNotConfigured = "__DOMAIN_NOT_CONFIGURED__";

const rawPublicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL ?? domainNotConfigured;

export const publicSiteUrl = rawPublicSiteUrl.trim() || domainNotConfigured;

export const isPublicSiteUrlConfigured = publicSiteUrl !== domainNotConfigured;
