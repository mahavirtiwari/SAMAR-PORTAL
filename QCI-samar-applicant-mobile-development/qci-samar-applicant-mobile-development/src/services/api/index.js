import AccountService from './accountService';
import ApplicationService from './applicationService';
import PublicClient from './clients/publicClient';
import SiteService from './siteService';

const Api = {
  CommonApi: AccountService(PublicClient),
  ApplicationApi: ApplicationService(),
  SiteApi: SiteService(),
};

export default Api;
