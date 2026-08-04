import { useAuth, useUser } from '@clerk/clerk-expo';
import { Button, Text, View } from 'react-native';

export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 18 }}>{user?.primaryEmailAddress?.emailAddress}</Text>
      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}
