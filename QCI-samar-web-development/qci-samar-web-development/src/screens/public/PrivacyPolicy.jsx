import { Container } from 'react-bootstrap';
import ContentBlock from '../../components/base/ContentBlock';
import Images from '../../constants/Images';
import useContentBlocks from '../../hooks/useContentBlocks';

// Public, unauthenticated page. Both mobile store listings point at this URL, so it
// must stay reachable without a login. Wording is the client's document, verbatim.

const FEEDBACK_EMAIL = 'samar@qcin.org';

const Section = ({ title, children }) => (
  <section className="mb-4">
    <h2 className="fs-20 fw-600 text-1-color mb-3">{title}</h2>
    {children}
  </section>
);

const SubHeading = ({ children }) => <h3 className="fs-16 fw-600 text-1-color mb-2">{children}</h3>;

const Para = ({ children }) => <p className="fs-14 fw-400 text-2-color mb-3">{children}</p>;

const PrivacyPolicy = () => {
  const blocks = useContentBlocks(['website_policy']);
  return (
    <section className="privacy-policy">
      <Container fluid className="d-flex flex-column align-items-center pt-4 pb-5">
        <div className="d-flex align-items-center justify-content-between gap-3 w-100 mb-5">
          <img src={Images.defenceResearch} alt="Defence Research" className="logo50" />
          <img src={Images.qualityCouncil} alt="Quality Council" className="logo50" />
        </div>

        <div className="privacy-policy-card">
          <div className="d-flex flex-column align-items-center mb-4">
            <img src={Images.samarLogo} alt="SAMAR Logo" className="privacy-policy-logo mb-3" />
            <h1 className="fs-20 fw-600 primary-color mb-0 text-center">{blocks.website_policy?.title || 'Terms & Conditions and Website Policy'}</h1>
          </div>

          {/* Editable in Settings → Content & Disclaimers; the sections below are the fallback. */}
          <ContentBlock block={blocks.website_policy} className="content-block policy-content">
            <Section title="Disclaimer">
              <Para>
                The terms &amp; conditions and website policies of SAMAR are same as that of DRDO. May also refer to DRDO website for terms &amp; conditions and policies. For the benefit and
                convenience of the viewer, the terms and policies available on the DRDO website are replicated below.
              </Para>
            </Section>

            <Section title="Terms & Conditions">
              <Para>
                This website is designed, developed and maintained by Defence R&amp;D Organisation (DRDO), Ministry of Defence, Government of India. DESIDOC, a constituent of DRDO, is the nodal agency
                for this activity.
              </Para>
              <Para>
                These terms and conditions shall be governed by and construed in accordance with the Indian Laws. Any dispute arising under these terms and conditions shall be subject to the
                jurisdiction of the courts of India, New Delhi.
              </Para>
              <Para>
                The information posted on this website could include hypertext links or pointers to information created and maintained by non-Government/private organisations. DRDO is providing these
                links and pointers solely for your information and convenience. When you select a link to an outside website, you are leaving the &apos;Guidelines for Indian Government Websites&apos;
                site and are subject to the privacy and security policies of the owners/sponsors of the outside website.
              </Para>
            </Section>

            <Section title="Privacy Policy">
              <Para>
                This website does not automatically capture any specific personal information from you, (like name, phone number or e-mail address), that allows us to identify you individually.
              </Para>
              <Para>
                Wherever the Website requests you to provide personal information, you will be informed for the particular purposes for which the information is gathered and adequate security measures
                will be taken to protect your personal information.
              </Para>
              <Para>
                We do not sell or share any personally identifiable information volunteered on the website site to any third party (public/private). Any information provided to this Website will be
                protected from loss, misuse, unauthorized access or disclosure, alteration, or destruction.
              </Para>
              <Para>
                We gather certain information about the User, such as Internet protocol (IP) addresses, domain name, browser type, operating system, the date and time of the visit and the pages
                visited. We make no attempt to link these addresses with the identity of individuals visiting our site unless an attempt to damage the site has been detected.
              </Para>
            </Section>

            <Section title="Copyright Policy">
              <Para>
                Material featured on this Portal may be reproduced free of charge after taking proper permission by sending a mail to us. However, the material has to be reproduced accurately and not
                to be used in a derogatory manner or in a misleading context.
              </Para>
              <Para>
                Wherever the material is being published or issued to others, the source must be prominently acknowledged. However, the permission to reproduce this material shall not extend to any
                material which is identified as being copyright of a third party. Authorisation to reproduce such material must be obtained from the departments/copyright holders concerned.
              </Para>
            </Section>

            <Section title="Hyperlinking Policy">
              <SubHeading>Links to external websites / portals:</SubHeading>
              <Para>
                At many places in this website, you shall find links to other websites/portals. The links have been placed for your convenience. DRDO is not responsible for the contents and
                reliability of the linked websites and does not necessarily endorse the views expressed in them.
              </Para>
              <Para>
                Mere presence of the link or its listing on this Portal should not be assumed as endorsement of any kind. We cannot guarantee that these links will work all the time and we have no
                control over availability of linked pages.
              </Para>
              <SubHeading>Links to SAMAR website by other websites:</SubHeading>
              <Para>
                We do not object to you linking directly to the information that is hosted on this site and no prior permission is required for the same. However, we would like you to inform us about
                any links provided to this Portal so that you can be informed of any changes or updations therein.
              </Para>
              <Para>Also, we do not permit our pages to be loaded into frames on your site. The pages belonging to this site must load into a newly opened browser window of the User.</Para>
            </Section>

            <Section title="Website Monitoring Policy">
              <Para>
                DRDO has a Website Monitoring Policy in place and the website is monitored periodically to address and fix the quality and compatibility issues around the following parameters:
              </Para>
              <SubHeading>Performance:</SubHeading>
              <Para>Site download time is optimized for a variety of network connections as well as devices. All- important pages of the website are tested for this.</Para>
              <SubHeading>Functionality:</SubHeading>
              <Para>All modules of the website are tested for their functionality. The interactive components of the site such as, feedback forms are working smoothly.</Para>
              <SubHeading>Broken Links:</SubHeading>
              <Para>The website is thoroughly reviewed to rule out the presence of any broken links or errors.</Para>
              <SubHeading>Traffic Analysis:</SubHeading>
              <Para>The site traffic is regularly monitored to analyse the usage patterns.</Para>
            </Section>

            <Section title="Feedback">
              <Para>
                Feedback from the visitors is the best way to judge a website&apos;s performance and make necessary improvements. For any suggestions / queries, please mail to{' '}
                <a href={`mailto:${FEEDBACK_EMAIL}`} className="primary-color fw-600">
                  {FEEDBACK_EMAIL}
                </a>
              </Para>
            </Section>
          </ContentBlock>
        </div>
      </Container>
    </section>
  );
};

export default PrivacyPolicy;
