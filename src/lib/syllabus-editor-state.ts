type TopicState = {
  id?: number; weekNumber: number; durationWeeks: number; title: string;
  subtopics: string[]; objectives: string[]; coreCompetencies: string[]; teachingResources: string;
};
function content(topic: TopicState) {
  return JSON.stringify([topic.weekNumber, topic.durationWeeks, topic.title, topic.subtopics, topic.objectives, topic.coreCompetencies, topic.teachingResources]);
}
export function hasUnsavedSyllabusTopics(topics: TopicState[], savedTopics: TopicState[]) {
  const saved = new Map(savedTopics.map((topic) => [topic.id, topic]));
  return topics.some((topic) => !topic.id || !saved.has(topic.id) || content(topic) !== content(saved.get(topic.id)!));
}
