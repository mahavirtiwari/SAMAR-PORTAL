import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import PropTypes from 'prop-types';
import Images from '../../constants/Images';

const Overlay = styled(Box)(() => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(245,245,250,0.95))',
  zIndex: 1400,
  flexDirection: 'column',
  gap: 24,
}));

const Logo = styled('img')(({ size }) => ({
  width: size || 120,
  height: 'auto',
  objectFit: 'contain',
  display: 'block',
}));

const ProgressBar = styled('div')(({ theme }) => ({
  width: 200,
  height: 4,
  backgroundColor: theme.palette.grey[200],
  borderRadius: 2,
  overflow: 'hidden',
  position: 'relative',
  '& .progress-fill': {
    position: 'absolute',
    height: '100%',
    width: '40%',
    backgroundColor: theme.palette.primary.main,
    borderRadius: 2,
    animation: 'progressSlide 1.2s ease-in-out infinite',
  },
  '@keyframes progressSlide': {
    '0%': { left: '-40%' },
    '100%': { left: '100%' },
  },
}));

const FullScreenLoader = ({ loading = false, logoSize = 130 }) => {
  if (!loading) {
    return null;
  }

  return (
    <Overlay>
      <Logo src={Images.samarLogo || Images.logo} alt="logo" size={logoSize} />
      <ProgressBar>
        <div className="progress-fill" />
      </ProgressBar>
    </Overlay>
  );
};

FullScreenLoader.propTypes = {
  loading: PropTypes.bool,
  logoSize: PropTypes.number,
};

export default FullScreenLoader;
