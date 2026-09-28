import { useCallback, useState } from 'react';
import { Modal, SectionList, Text, View } from 'react-native';
import { ScrollView } from 'react-native-css/components';
import { asApiError } from '../api/client';
import { getCatalogue, saveSelectedTasks, type CatalogueTask } from '../api/tasks';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { EmptyView, ErrorView, LoadingView } from '../components/StateViews';
import { Screen } from '../components/Screen';
import { TaskRow } from '../components/TaskRow';
import { TextField } from '../components/TextField';
import { TextLink } from '../components/TextLink';
import { useRequest } from '../hooks/useRequest';

type TaskSelectionScreenProps = {
  token: string;
  initialSelection: number[];
  onDone: () => void;
  onCancel?: () => void;
};

type TaskSection = { id: number; title: string; data: CatalogueTask[] };

function matches(task: CatalogueTask, needle: string): boolean {
  return (
    task.name.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle)
  );
}

export function TaskSelectionScreen({
  token,
  initialSelection,
  onDone,
  onCancel,
}: TaskSelectionScreenProps) {
  const load = useCallback(() => getCatalogue(token), [token]);
  const { state, reload } = useRequest(load);

  const [selected, setSelected] = useState<number[]>(initialSelection);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(id: number): void {
    setSelected((current) =>
      current.includes(id) ? current.filter((taskId) => taskId !== id) : [...current, id],
    );
  }

  async function confirm(): Promise<void> {
    setSaveError(null);
    setSaving(true);
    try {
      await saveSelectedTasks(token, selected);
      onDone();
    } catch (caught) {
      const error = asApiError(caught);
      setSaveError(error.fields.taskIds ?? error.message);
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <Screen>
        <LoadingView label="Loading tasks…" />
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

  const { categories } = state.data;
  const needle = search.trim().toLowerCase();

  const sections: TaskSection[] = categories
    .map((category) => ({
      id: category.id,
      title: category.name,
      data: needle === '' ? category.tasks : category.tasks.filter((task) => matches(task, needle)),
    }))
    .filter((section) => section.data.length > 0);

  const catalogueIsEmpty = categories.every((category) => category.tasks.length === 0);

  const chosen = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      tasks: category.tasks.filter((task) => selected.includes(task.id)),
    }))
    .filter((group) => group.tasks.length > 0);

  return (
    <Screen>
      <View className="gap-4 px-6 pb-2 pt-4">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-ink">Choose your tasks</Text>
          <Text className="text-base text-muted">Pick everything you would rather not do.</Text>
        </View>

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          label="Search tasks"
          onChangeText={setSearch}
          placeholder="Try cleaning, bills, groceries"
          returnKeyType="search"
          value={search}
        />
      </View>

      <SectionList<CatalogueTask, TaskSection>
        className="flex-1"
        keyExtractor={(task) => String(task.id)}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          catalogueIsEmpty ? (
            <EmptyView
              message="The task catalogue is empty right now. Please try again later."
              title="No tasks available"
            />
          ) : (
            <EmptyView
              message="Try a different word, or clear the search to see everything."
              title={`No tasks match “${search.trim()}”`}
            />
          )
        }
        renderItem={({ item }) => (
          <TaskRow
            description={item.description}
            name={item.name}
            onPress={() => toggle(item.id)}
            selected={selected.includes(item.id)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text className="bg-white px-6 pb-1 pt-4 text-sm font-semibold uppercase text-muted">
            {section.title}
          </Text>
        )}
        sections={sections}
      />

      <View className="gap-3 border-t border-line px-6 py-4">
        {selected.length === 0 ? (
          <Text className="text-center text-sm text-muted">
            Choose at least one task to continue.
          </Text>
        ) : null}

        <Button
          disabled={selected.length === 0}
          label={`Continue (${selected.length} selected)`}
          onPress={() => setConfirming(true)}
        />

        {onCancel === undefined ? null : <TextLink label="Cancel" onPress={onCancel} />}
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setConfirming(false)}
        transparent
        visible={confirming}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[80%] gap-4 rounded-t-3xl bg-white px-6 pb-8 pt-6">
            <View className="gap-1">
              <Text className="text-xl font-semibold text-ink">Confirm your tasks</Text>
              <Text className="text-base text-muted">
                {selected.length} {selected.length === 1 ? 'task' : 'tasks'} selected.
              </Text>
            </View>

            {saveError === null ? null : <Banner message={saveError} tone="error" />}

            <ScrollView className="grow-0">
              <View className="gap-4">
                {chosen.map((group) => (
                  <View className="gap-1" key={group.id}>
                    <Text className="text-sm font-semibold uppercase text-muted">{group.name}</Text>
                    {group.tasks.map((task) => (
                      <Text className="text-base text-ink" key={task.id}>
                        {task.name}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>

            <Button label="Confirm" loading={saving} onPress={confirm} />
            <Button
              disabled={saving}
              label="Edit"
              onPress={() => setConfirming(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
