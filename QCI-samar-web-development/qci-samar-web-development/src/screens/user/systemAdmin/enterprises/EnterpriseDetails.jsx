import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBadge, FullScreenLoader } from '../../../../components/base';
import AppIconButton from '../../../../components/base/AppIconButton';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getOrganizationByIdAction } from '../../../../redux/action/systemAdmin/EnterprisesAction';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';

const EnterpriseDetails = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const { organization, organizationLoading } = useSelector(state => state.SystemAdminEnterprises);
  useEffect(() => {
    dispatch(getOrganizationByIdAction(params.id));
  }, [params.id, dispatch]);
  const navigate = useNavigate();
  return (
    <Layout
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Enterprise Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Enterprises</li>
                <div className="dot-separator" />
                <li>Enterprise Details</li>
              </ul>
            </div>
          </div>
        </div>
      }>
      {organizationLoading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '500px' }}>
          <FullScreenLoader loading={true} />
        </div>
      ) : (
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="details-card">
                  <div className="top-details-card-content">
                    <div className="top-right-details-card">
                      <div className="rowBetween">
                        <div>
                          <div className="rowCenter">
                            <h4 className="fs-24 fw-600 heading-color mb-0">{organization?.organization?.name ? organization?.organization?.name : '-'}</h4>
                            <AppBadge variant={getBadgeVariantByLabel(organization?.organization?.status)} label={getStatusLabel(organization?.organization?.status)} className="margin-left-10" />
                          </div>
                          <div className="d-flex align-items-center margin-top-8">
                            <img src={Icons.user} alt="admin" className="icon-18 margin-right-4" />
                            <p className="mb-0 fs-12 fw-500 text-3-color">Enterprise Admin:</p>
                            <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{organization?.organization?.enterpriseAdmin ? organization?.organization?.enterpriseAdmin : '-'}</p>
                            <img src={Icons.location} alt="location" className="icon-18 margin-left-16 margin-right-4" />
                            <p className="mb-0 fs-12 fw-500 text-3-color">Address:</p>
                            <p className="fs-12 fw-500 text-2-color mb-0 margin-left-4">{organization?.organization?.registeredAddress ? organization?.organization?.registeredAddress : '-'}</p>
                          </div>
                        </div>
                        <div className="date-commencement-container">
                          <p className="fs-14 fw-500 heading-color mb-0 text-end">{organization?.organization?.pan ? organization?.organization?.pan : '-'}</p>
                          <p className="fs-12 fw-500 text-3-color mb-0 text-end">Enterprise PAN</p>
                        </div>
                      </div>

                      <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl margin-top-16">
                        <li>
                          <img src={Icons.call} alt="mobile" className="icon-18 margin-right-4" />
                          <p className="mb-0 fs-12 fw-500 text-3-color">Mobile Number:</p>
                          <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{organization?.organization?.mobileNumber ? organization?.organization?.mobileNumber : '-'}</p>
                        </li>
                        <li>
                          <img src={Icons.landline} alt="landline" className="icon-18 margin-right-4" />
                          <p className="mb-0 fs-12 fw-500 text-3-color">Landline Number:</p>
                          <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{organization?.organization?.landlineNumber ? organization?.organization?.landlineNumber : '-'}</p>
                        </li>
                        <li>
                          <img src={Icons.email} alt="email" className="icon-18 margin-right-4" />
                          <p className="mb-0 fs-12 fw-500 text-3-color">Email:</p>
                          <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{organization?.organization?.email ? organization?.organization?.email : '-'}</p>
                        </li>
                        <li>
                          <img src={Icons.email} alt="email" className="icon-18 margin-right-4" />
                          <p className="mb-0 fs-12 fw-500 text-3-color">Alternate Email:</p>
                          <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{organization?.organization?.alternateEmail ? organization?.organization?.alternateEmail : '-'}</p>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="details-card">
                  <div className="bottom-EnterpriseInfo">
                    <h5 className="heading-color">Owner Details:</h5>
                    <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl">
                      <li>
                        <img src={Icons.user} alt="" className="icon-20 margin-right-8" />
                        <p className="fs-12 fw-400 mb-0 text-3-color">Name:</p>
                        <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{organization?.organization?.ownerName ? organization?.organization?.ownerName : '-'}</p>
                      </li>
                      <li>
                        <img src={Icons.designation} alt="" className="icon-20 margin-right-8" />
                        <p className="fs-12 fw-400 mb-0 text-3-color">Designation:</p>
                        <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{organization?.organization?.ownerDesignation ? organization?.organization?.ownerDesignation : '-'}</p>
                      </li>
                      <li>
                        <img src={Icons.receiver} alt="" className="icon-20 margin-right-8" />
                        <p className="fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                        <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{organization?.organization?.ownerMobileNumber ? organization?.organization?.ownerMobileNumber : '-'}</p>
                      </li>
                      <li>
                        <img src={Icons.email} alt="" className="icon-20 margin-right-8" />
                        <p className="fs-12 fw-400 mb-0 text-3-color">Email:</p>
                        <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{organization?.organization?.ownerEmail ? organization?.organization?.ownerEmail : '-'}</p>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default EnterpriseDetails;
