import { useCallback, useState } from 'react';
import { RefreshControl, SectionList, Text, View } from 'react-native';
import { getMe } from '../api/me';
import { getSelectedTasks, type SelectedTask } from '../api/tasks';
import { useSession } from '../auth/SessionProvider';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { Screen } from '../components/Screen';
import { useRequest } from '../hooks/useRequest';

type HomeScreenProps = {
  token: string;
  onEditTasks: (currentSelection: number[]) => void;
};

type TaskSection = { id: number; title: string; data: SelectedTask[] };

async function loadHome(token: string): Promise<{ name: string; tasks: SelectedTask[] }> {
  const [me, selected] = await Promise.all([getMe(token), getSelectedTasks(token)]);
  return { name: me.profile?.fullName ?? me.user.email, tasks: selected.tasks };
}

function groupByCategory(tasks: SelectedTask[]): TaskSection[] {
  const sections: TaskSection[] = [];
  for (const task of tasks) {
    const existing = sections.find((section) => section.id === task.categoryId);
    if (existing === undefined) {
      sections.push({ id: task.categoryId, title: task.categoryName, data: [task] });
    } else {
      existing.data.push(task);
    }
  }
  return sections;
}

export function HomeScreen({ token, onEditTasks }: HomeScreenProps) {
  const { signOut } = useSession();
  const load = useCallback(() => loadHome(token), [token]);
  const { state, reload } = useRequest(load);

  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  async function logOut(): Promise<void> {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorView message={state.message} onRetry={reload} />
      </Screen>
    );
  }

  const { name, tasks } = state.data;
  const firstName = name.split(' ')[0] ?? name;

  return (
    <Screen>
      <View className="gap-1 px-6 pb-2 pt-4">
        <Text className="text-2xl font-semibold text-ink">Hello, {firstName}</Text>
        <Text className="text-base text-muted">
          {tasks.length === 0
            ? 'You have no tasks yet.'
            : `We are handling ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} for you.`}
        </Text>
      </View>

      <SectionList<SelectedTask, TaskSection>
        className="flex-1"
        keyExtractor={(task) => String(task.id)}
        ListEmptyComponent={
          <EmptyView
            message="Pick the tasks you want us to take over."
            title="No tasks selected yet"
          />
        }
        refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} />}
        renderItem={({ item }) => (
          <View className="gap-0.5 px-6 py-3">
            <Text className="text-base font-medium text-ink">{item.name}</Text>
            <Text className="text-sm text-muted">{item.description}</Text>
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <Text className="bg-white px-6 pb-1 pt-4 text-sm font-semibold uppercase text-muted">
            {section.title}
          </Text>
        )}
        sections={groupByCategory(tasks)}
      />

      <View className="gap-3 border-t border-line px-6 py-4">
        <Button
          disabled={signingOut}
          label="Edit tasks"
          onPress={() => onEditTasks(tasks.map((task) => task.id))}
        />
        <Button label="Log out" loading={signingOut} onPress={logOut} variant="secondary" />
      </View>
    </Screen>
  );
}
