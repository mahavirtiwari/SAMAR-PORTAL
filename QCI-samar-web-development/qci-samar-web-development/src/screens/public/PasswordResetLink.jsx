import { Col, Container, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import AppButton from '../../components/base/AppButton';
import { PublicHeader } from '../../components/layout';
import Icons from '../../constants/Icons';

const PasswordResetLink = () => {
  const navigate = useNavigate();
  return (
    <section className="forgotPasswordSection">
      <PublicHeader />
      <Container>
        <Row className="justify-content-center align-items-center forgotPasswordContainer">
          <Col xs={12} sm={10} md={8} lg={6}>
            <div className="forgotPasswordCard text-center">
              <img src={Icons.messageCircle} alt="lock" className="icon-130" />
              <div className="margin-top-40">
                <h2 className="fs-24 fw-600 heading-color mb-0">Password Reset Link Sent</h2>
                <p className="fs-14 fw-500 mb-0 text-2-color margin-top-8">
                  If this is a registered account, reset instructions will be sent to your email address. Please check your junk folder if you do not see it in your inbox. If you still do not receive
                  it, try resending the reset instructions. If you do not know your registered email, please contact our Support Team.
                </p>
                <div className="margin-top-50">
                  <AppButton
                    title={'Go to Inbox'}
                    size="large"
                    customClass={'w-100'}
                    onClick={() => {
                      navigate('/new-password');
                    }}
                  />
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default PasswordResetLink;
