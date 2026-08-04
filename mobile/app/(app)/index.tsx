import { useAuth, useUser } from '@clerk/clerk-expo';
import { Button, Text, View } from 'react-native';

export default function Home() {
  const { signOut } = useAuth();
  const { user } = useUser();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontSize: 18 }}>Signed in ✅</Text>
      <Text style={{ color: '#666' }}>{user?.primaryEmailAddress?.emailAddress}</Text>
      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}
