import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { commonStyles } from '../../../../assets/theme/Styles';
import { AppButton } from '../../../../components';

const FailedSyncModal = ({
  visible,
  failedItems,
  humanizeOp,
  retryingFailed,
  onRetry,
  onDiscard,
  onClose
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          padding: 24
        }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
            <Text style={[commonStyles.bodyMediumPrimary600]}>Items that couldn’t sync</Text>
            <Text style={[commonStyles.bodyXSmallSecondary600, { marginTop: 4 }]}>
              Retry to send them again. Discard only if it can’t be fixed — the item’s data won’t be
              saved to the server.
            </Text>
          </View>
          <ScrollView style={{ maxHeight: 300 }}>
            {failedItems.length === 0 ? (
              <Text
                style={[commonStyles.bodySmallTertiary500, { padding: 16, textAlign: 'center' }]}>
                Nothing stuck.
              </Text>
            ) : (
              failedItems.map((item) => (
                <View
                  key={item.id}
                  style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' }}>
                  <Text style={[commonStyles.bodySmallPrimary600]}>{humanizeOp(item.op_type)}</Text>
                  {item.last_error ? (
                    <Text
                      style={[commonStyles.bodyXSmallTertiary500, { marginTop: 2 }]}
                      numberOfLines={2}>
                      {item.last_error}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => onDiscard(item.id)}
                    style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                    <Text style={{ color: '#D32F2F', fontWeight: '600' }}>Discard</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
            <View style={{ flex: 1 }}>
              <AppButton
                title={retryingFailed ? 'Retrying…' : 'Retry all'}
                disabled={retryingFailed}
                variant="primary"
                size="large"
                onPress={onRetry}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton title="Close" variant="secondary" size="large" onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default FailedSyncModal;
