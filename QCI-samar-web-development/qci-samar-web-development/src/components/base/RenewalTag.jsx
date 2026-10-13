import { isRenewalApplication } from '../../utils/applicationUtils';
import AppBadge from './AppBadge';

const RenewalTag = ({ application, className }) => (isRenewalApplication(application) ? <AppBadge variant="purple" label="Renewal" className={className} /> : null);

export default RenewalTag;
