import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
  Platform,
} from "react-native";
import { Surface, Button, ProgressBar, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiFetch from "./apiFetch";

/**
 * UserLessonPlans
 * 
 * Displays the user's lesson plans, allowing browsing, assignment, and progress tracking of chapters and subtopics.
 * 
 * Props: None
 */
export default function UserLessonPlans() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;

  const [view, setView] = useState("subjects"); // subjects | sections-with-chapters | sections | chapters | chapter-detail | my-chapters
  const [previousView, setPreviousView] = useState("subjects");
  const [userSubjects, setUserSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [chapterDetail, setChapterDetail] = useState(null);
  const [userChapters, setUserChapters] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [assignedChapters, setAssignedChapters] = useState([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewContext, setViewContext] = useState("browse"); // 'browse' or 'assigned'

  useEffect(() => {
    loadUserSubjects();
    loadAssignedChapters();
  }, []);

  // Refresh sections whenever userChapters changes (after assignment)
  useEffect(() => {
    if (view === "sections-with-chapters" && selectedSubject) {
      console.log("🔄 userChapters updated, reloading sections for filter refresh");
      loadSectionsWithChapters(selectedSubject);
    }
  }, [userChapters, selectedSubject?.class_subject_id]);

  const loadUserSubjects = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/classes/list_user_class_subjects.php", {
        method: "GET",
      });
      if (Array.isArray(data)) {
        setUserSubjects(data);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const loadSectionsWithChapters = async (subject = null) => {
    const targetSubject = subject || selectedSubject;
    setLoading(true);
    try {
      // Fetch sections metadata
      const sectionsData = await apiFetch(
        `/curriculum/list_sections.php?class_subject_id=${targetSubject.class_subject_id}`,
        { method: "GET" }
      );

      if (!Array.isArray(sectionsData)) {
        throw new Error("Invalid sections response");
      }

      console.log("📚 Sections loaded:", sectionsData);

      if (sectionsData.length === 0) {
        console.log("⚠️ No sections found; trying list_chapters.php fallback");
        const chaptersFallback = await apiFetch(
          `/curriculum/list_chapters.php?class_subject_id=${targetSubject.class_subject_id}`,
          { method: "GET" }
        );

        if (Array.isArray(chaptersFallback) && chaptersFallback.length > 0) {
          console.log("✅ Fallback chapters loaded:", chaptersFallback.length);

          // Group by section_type (or General default) so all names appear 
          // instead of forcing a single General section
          const grouped = chaptersFallback.reduce((acc, ch) => {
            const sectionName = (ch.section_type || "").trim() || "General";
            if (!acc[sectionName]) {
              acc[sectionName] = {
                section_type: sectionName,
                chapter_count: 0,
                total_subtopics: 0,
                total_days: 0,
                chapters: [],
              };
            }
            acc[sectionName].chapters.push(ch);
            acc[sectionName].chapter_count += 1;
            acc[sectionName].total_subtopics += parseInt(ch.total_subtopics, 10) || 0;
            acc[sectionName].total_days += parseInt(ch.total_days, 10) || 0;
            return acc;
          }, {});

          const sectionsFromChapters = Object.values(grouped);
          setSections(sectionsFromChapters);
          
          // Check if all sections are "General" (empty section_type)
          const allEmptySectionType = sectionsFromChapters.every(s => s.section_type === "General");
          if (allEmptySectionType && sectionsFromChapters.length > 0) {
            console.log("📖 Fallback: All chapters have empty section_type - showing chapters directly");
            // Automatically set activeSection to skip section card view
            setActiveSection(sectionsFromChapters[0]);
          }
          
          setView("sections-with-chapters");
          return;
        }

        // If the database has no syllabus sections/chapters but user already has assigned progress entries,
        // show those chapters so the user can continue working.
        const assignedChaptersForSubject = userChapters.filter(
          (ch) => Number(ch.class_subject_id) === Number(targetSubject.class_subject_id)
        );

        if (assignedChaptersForSubject.length > 0) {
          console.log("⚙️ No syllabus chapters found; using assigned chapters from progress:", assignedChaptersForSubject.length);
          const generalSection = {
            section_type: "Assigned Chapters",
            chapter_count: assignedChaptersForSubject.length,
            total_subtopics: assignedChaptersForSubject.reduce((sum, ch) => sum + (parseInt(ch.total_subtopics, 10) || 0), 0),
            total_days: 0,
            chapters: assignedChaptersForSubject.map((ch) => ({
              chapter_no: ch.chapter_no,
              chapter_name: ch.chapter_name || `Chapter ${ch.chapter_no}`,
              total_subtopics: ch.total_subtopics || 0,
              total_days: 0,
            })),
          };
          setSections([generalSection]);
          // Automatically show chapters for this section
          setActiveSection(generalSection);
          setView("sections-with-chapters");
          return;
        }
      }

      // Fetch chapters for each section
      const sectionsWithChapters = await Promise.all(
        sectionsData.map(async (section) => {
          try {
            const chaptersData = await apiFetch(
              `/curriculum/list_chapters_by_section.php?class_subject_id=${targetSubject.class_subject_id}&section_type=${encodeURIComponent(section.section_type)}`,
              { method: "GET" }
            );

            const chapters = Array.isArray(chaptersData) ? chaptersData : [];
            console.log(`Section "${section.section_type}": expecting ${section.chapter_count} chapters, got ${chapters.length}`);
            return {
              ...section,
              chapters: chapters,
            };
          } catch (err) {
            console.error(`Error loading chapters for section "${section.section_type}":`, err);
            return {
              ...section,
              chapters: [],
            };
          }
        })
      );

      console.log("✅ Final sections with chapters:", sectionsWithChapters);
      setSections(sectionsWithChapters);
      
      // Check if all sections have empty section_type (all showing as "General")
      const allEmptySectionType = sectionsWithChapters.length > 0 && 
        sectionsWithChapters.every(s => s.section_type === "General");
      
      if (allEmptySectionType) {
        console.log("📖 All chapters have empty section_type - showing chapters directly");
        // Merge all chapters from all sections into one
        const allChapters = sectionsWithChapters.flatMap(s => s.chapters);
        const mergedSection = {
          section_type: "All Chapters",
          chapter_count: allChapters.length,
          total_subtopics: sectionsWithChapters.reduce((sum, s) => sum + (s.total_subtopics || 0), 0),
          total_days: sectionsWithChapters.reduce((sum, s) => sum + (s.total_days || 0), 0),
          chapters: allChapters,
        };
        // Automatically set activeSection to skip section card view
        setActiveSection(mergedSection);
      }
      
      setView("sections-with-chapters");
    } catch (err) {
      console.error("💾 loadSectionsWithChapters ERROR:", err);
      Alert.alert("Error", "Failed to load sections with chapters");
    } finally {
      setLoading(false);
    }
  };

  const loadChapterDetail = async (chapterId, subject = null) => {
    setLoading(true);

    const subj =
      subject ||
      selectedSubject ||
      (chapterDetail && chapterDetail.chapter ? {
        class_id: chapterDetail.chapter.class_id,
        subject_id: chapterDetail.chapter.subject_id,
      } : null);

    if (!subj || !subj.class_id || !subj.subject_id) {
      console.error("loadChapterDetail missing subject context", { subject, selectedSubject, chapterDetail });
      Alert.alert("Error", "No subject selected for chapter details");
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch(
        `/curriculum/get_chapter_progress.php?class_id=${subj.class_id}&subject_id=${subj.subject_id}&chapter_no=${chapterId}`,
        { method: "GET" }
      );

      if (!data || typeof data !== "object") {
        throw new Error("Invalid chapter data");
      }

      setSelectedChapter(chapterId);
      setSelectedSubject({ ...subj });
      setChapterDetail(data);
      setPreviousView(view);
      setView("chapter-detail");
    } catch (err) {
      console.error("Error loading chapter:", err);
      Alert.alert("Error", "Failed to load chapter details: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedChapters = async () => {
    try {
      console.log("🔄 Loading assigned chapters...");
      const data = await apiFetch("/curriculum/get_user_chapters.php", {
        method: "GET",
      });
      console.log("📖 Assigned chapters API response:", data);
      if (Array.isArray(data)) {
        console.log(`✅ Loaded ${data.length} assigned chapters`);
        // Log each chapter's details for debugging
        data.forEach((ch, idx) => {
          console.log(
            `  [${idx}] Chapter ${ch.chapter_no} (type: ${typeof ch.chapter_no}), class_subject_id: ${ch.class_subject_id} (type: ${typeof ch.class_subject_id}), subject: ${ch.subject_name}`
          );
        });
        setUserChapters(data);
        setAssignedChapters(data);
      } else {
        console.warn("⚠️ API response is not an array:", data);
        console.warn("Response type:", typeof data);
        setUserChapters([]);
        setAssignedChapters([]);
      }
    } catch (err) {
      console.error("❌ Error loading assigned chapters:", err);
      console.error("Error details:", err.message);
      setUserChapters([]);
      setAssignedChapters([]);
    }
  };

  const handleSelectSubject = (subject) => {
    setSelectedSubject(subject);
    console.log("🔍 Subject selected:", subject.subject_name, "Assigned chapters count:", userChapters.length);
    loadSectionsWithChapters(subject);
  };

  const handleSelectChapter = (chapter, section = null) => {
    setViewContext("browse");
    setSelectedSection(section);
    loadChapterDetail(chapter.chapter_no);
  };

  const handleSelectAssignedChapter = (chapter) => {
    setViewContext("assigned");

    // Try to find the subject in userSubjects, but don't fail if not found
    const subject = userSubjects.find((s) => s.class_subject_id === chapter.class_subject_id);
    const selected = subject || {
      class_id: chapter.class_id,
      subject_id: chapter.subject_id,
      class_subject_id: chapter.class_subject_id,
      class_name: chapter.class_name,
      subject_name: chapter.subject_name,
    };

    setSelectedSubject(selected);
    loadChapterDetail(chapter.chapter_no, selected);
  };

  const markSubtopicComplete = async (topicName, subTopicName) => {
    setLoading(true);
    try {
      const classSubjectId = selectedSubject?.class_subject_id || chapterDetail?.chapter?.class_subject_id || chapterDetail?.class_subject_id;
      const chapterNo = selectedChapter || chapterDetail?.chapter?.chapter_no || chapterDetail?.chapter_no;

      if (!classSubjectId || !chapterNo) {
        console.error("markSubtopicComplete context state:", {
          selectedSubject,
          selectedChapter,
          chapterDetail,
          classSubjectId,
          chapterNo,
        });
        throw new Error("Missing selected subject or chapter context");
      }

      if (!topicName || !subTopicName) {
        throw new Error("Invalid topic or subtopic data");
      }

      const payload = {
        class_subject_id: Number(classSubjectId),
        chapter_no: Number(chapterNo),
        topic: String(topicName),
        sub_topic: String(subTopicName),
      };

      console.log("📡 Marking subtopic complete payload:", payload);
      const result = await apiFetch("/curriculum/complete_subtopic.php", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result.success) {
        // Check if entire chapter is now complete
        if (result.chapter_complete) {
          Alert.alert("🎉 Success", "All subtopics completed! Chapter marked as complete");
        } else {
          Alert.alert("Success", "Subtopic marked complete");
        }

        // Optimistically update local state so button shows Completed immediately
        setChapterDetail((prev) => {
          if (!prev || !Array.isArray(prev.sections)) return prev;
          const updatedSections = prev.sections.map((section) => ({
            ...section,
            topics: section.topics.map((topic) => {
              if (topic.topic_name !== topicName) return topic;
              return {
                ...topic,
                subtopics: topic.subtopics.map((subtopic) => {
                  if (subtopic.sub_topic !== subTopicName) return subtopic;
                  return {
                    ...subtopic,
                    status: "completed",
                    completed_date: new Date().toLocaleDateString(),
                  };
                }),
              };
            }),
          }));
          return {
            ...prev,
            sections: updatedSections,
          };
        });

        loadChapterDetail(selectedChapter, selectedSubject);
        loadAssignedChapters();
      } else {
        throw new Error(result.error || "Marking subtopic complete failed");
      }
    } catch (err) {
      const errMsg = err.message || "Failed to mark subtopic complete";
      console.error("markSubtopicComplete error:", errMsg);
      Alert.alert("Error", errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSubtopicComplete = React.useCallback(
    (topicName, subTopicName) => () => markSubtopicComplete(topicName, subTopicName),
    [markSubtopicComplete, selectedSubject, selectedChapter]
  );

  const handleAssignChapter = async () => {
    if (isAlreadyAssigned()) {
      Alert.alert("Cannot Assign", "This chapter is already assigned to you. Please complete it first.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        class_subject_id: selectedSubject?.class_subject_id,
        chapter_no: selectedChapter,
        section_type: selectedSection?.section_type || '',
        start_date: startDate,
      };
      const result = await apiFetch("/curriculum/assign_chapter.php", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.success) {
        Alert.alert("Success", "Chapter assigned successfully");
        setShowAssignModal(false);
        loadAssignedChapters();
        setView("my-chapters");
      }
    } catch (err) {
      const errMsg = err.message || "Failed to assign chapter";
      Alert.alert("Error", errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Check if chapter is fully completed
  const isChapterFullyComplete = () => {
    if (!chapterDetail || !Array.isArray(chapterDetail.sections)) return false;

    let totalSubtopics = 0;
    let completedSubtopics = 0;

    chapterDetail.sections.forEach((section) => {
      if (Array.isArray(section.topics)) {
        section.topics.forEach((topic) => {
          if (Array.isArray(topic.subtopics)) {
            topic.subtopics.forEach((subtopic) => {
              totalSubtopics++;
              if (subtopic.status === "completed") {
                completedSubtopics++;
              }
            });
          }
        });
      }
    });

    return totalSubtopics > 0 && totalSubtopics === completedSubtopics;
  };

  const isAlreadyAssigned = () => {
    const selectedChapterNum = Number(selectedChapter);
    const classSubjectIdNum = Number(selectedSubject?.class_subject_id);
    return userChapters.some(
      (ch) =>
        ch.class_subject_id === classSubjectIdNum &&
        ch.chapter_no === selectedChapterNum
    );
  };

  const isChapterAssigned = (chapterId, classSubjectId) => {
    // TEMPORARY FIX: Don't hide chapters to allow section-specific assignments
    // TODO: Make this section-aware once backend includes section_type in assigned chapters
    return false;
    
    // Original logic (commented out):
    // const chapterIdNum = Number(chapterId);
    // const classSubjectIdNum = Number(classSubjectId);
    // const assigned = userChapters.some(
    //   (ch) => ch.class_subject_id === classSubjectIdNum && ch.chapter_no === chapterIdNum
    // );
    // return assigned;
  };

  const renderSubjectsView = () => (
    <View>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, view === "subjects" && styles.activeTab]}
          onPress={() => setView("subjects")}
        >
          <Text style={[styles.tabText, view === "subjects" && styles.activeTabText]}>Browse</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, view === "my-chapters" && styles.activeTab]}
          onPress={() => setView("my-chapters")}
        >
          <Text style={[styles.tabText, view === "my-chapters" && styles.activeTabText]}>
            My Chapters ({userChapters.length})
          </Text>
        </TouchableOpacity>
      </View>

      {userSubjects.length === 0 ? (
        <Surface style={styles.emptyState}>
          <Text style={styles.emptyText}>No subjects assigned yet</Text>
        </Surface>
      ) : (
        <FlatList
          data={userSubjects}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleSelectSubject(item)} style={styles.subjectCard}>
              <Surface style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.subject_name}</Text>
                <Text style={styles.cardSubtitle}>Class: {item.class_name}</Text>
                <Button mode="contained" onPress={() => handleSelectSubject(item)} style={{ marginTop: 12 }}>
                  View Chapters
                </Button>
              </Surface>
            </TouchableOpacity>
          )}
          keyExtractor={(item) =>
            item.class_subject_id
              ? item.class_subject_id.toString()
              : `${item.subject_id}_${item.class_id}`
          }
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderSectionsWithChaptersView = () => (
    <View>
      <Button mode="outlined" onPress={() => setView("subjects")} style={styles.backButton}>
        ← Back to Subjects
      </Button>

      <Text style={styles.sectionTitle}>{selectedSubject?.subject_name} - Chapters by Section</Text>
      <Text style={{ marginHorizontal: 8, marginBottom: 8, fontSize: 12, color: "#666" }}>
        (Assigned: {userChapters.filter(ch => ch.class_subject_id === selectedSubject?.class_subject_id).length} chapters hidden)
      </Text>

      {sections.length === 0 ? (
        <Surface style={styles.emptyState}>
          <Text style={styles.emptyText}>No sections available</Text>
        </Surface>
      ) : activeSection ? (
        <View>
          {(() => {
            const allEmptySectionType = sections.length > 0 && sections.every(s => s.section_type === "General");
            return (
              <Button 
                mode="outlined" 
                onPress={() => {
                  if (allEmptySectionType) {
                    // If all sections are empty, go back to subjects
                    setView("subjects");
                    setActiveSection(null);
                    setSelectedSubject(null);
                  } else {
                    // Otherwise, go back to section cards
                    setActiveSection(null);
                  }
                }} 
                style={styles.backButton}
              >
                ← Back to {allEmptySectionType ? "Subjects" : "Sections"}
              </Button>
            );
          })()}
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>{activeSection.section_type}</Text>
          <Text style={{ marginHorizontal: 8, marginBottom: 12, fontSize: 12, color: "#666" }}>
            {activeSection.chapter_count} chapters • {activeSection.total_subtopics} subtopics • {activeSection.total_days} days
          </Text>

          {activeSection.chapters && activeSection.chapters.length > 0 ? (
            <View style={styles.chaptersContainer}>
              {activeSection.chapters
                .filter((chapter) => !isChapterAssigned(chapter.chapter_no, selectedSubject?.class_subject_id))
                .map((chapter) => (
                  <TouchableOpacity
                    key={chapter.chapter_no}
                    onPress={() => handleSelectChapter(chapter, activeSection)}
                    style={styles.chapterCard}
                  >
                    <Surface style={styles.cardContent}>
                      <Text style={styles.cardTitle}>
                        Chapter {chapter.chapter_no}: {chapter.chapter_name}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>📝 {chapter.total_subtopics} subtopics</Text>
                        <Text style={styles.metaText}>⏱️ {chapter.total_days} days</Text>
                      </View>
                    </Surface>
                  </TouchableOpacity>
                ))}
            </View>
          ) : (
            <Surface style={[styles.emptyState, styles.noChaptersCard]}>
              <Text style={styles.emptyText}>No available chapters for this section.</Text>
            </Surface>
          )}
        </View>
      ) : (
        <FlatList
          data={sections}
          renderItem={({ item }) => (
            <View key={item.section_type} style={styles.sectionContainer}>
              <Surface style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>{item.section_type}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>📚 {item.chapter_count} chapters</Text>
                  <Text style={styles.metaText}>📝 {item.total_subtopics} subtopics</Text>
                  <Text style={styles.metaText}>⏱️ {item.total_days} days</Text>
                </View>
                <Button mode="contained" onPress={() => setActiveSection(item)} style={{ marginTop: 10 }}>
                  View Chapters
                </Button>
              </Surface>
            </View>
          )}
          keyExtractor={(item) => item.section_type}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderChapterDetailView = () => (
    <View>
      <Button mode="outlined" onPress={() => setView(previousView)} style={styles.backButton}>
        ← Back to Chapters
      </Button>

      {!chapterDetail ? (
        <Text style={styles.emptyText}>Loading chapter details...</Text>
      ) : chapterDetail.error ? (
        <Surface style={styles.emptyState}>
          <Text style={styles.emptyText}>Error: {chapterDetail.error}</Text>
        </Surface>
      ) : !chapterDetail.sections || !Array.isArray(chapterDetail.sections) || chapterDetail.sections.length === 0 ? (
        <Surface style={styles.emptyState}>
          <Text style={styles.emptyText}>No subtopics found for this chapter</Text>
        </Surface>
      ) : (
        <View>
          <View style={styles.chapterHeaderContainer}>
            <View style={styles.chapterTitleSection}>
              <Text style={styles.sectionTitle}>
                Chapter {chapterDetail.chapter?.chapter_no}: {chapterDetail.chapter?.chapter_name}
              </Text>
            </View>

            {viewContext === "browse" && (
              <View style={styles.assignButtonTopSection}>
                {isChapterFullyComplete() ? (
                  <Surface style={[styles.assignButton, { backgroundColor: "#D1FAE5", borderWidth: 2, borderColor: "#059669" }]}>
                    <Text style={{ fontSize: 16, fontWeight: "700", textAlign: "center", color: "#065F46", paddingVertical: 12 }}>
                      ✅ Chapter Completed
                    </Text>
                  </Surface>
                ) : isAlreadyAssigned() ? (
                  <Surface style={[styles.assignButton, { backgroundColor: "#FEF3C7", borderWidth: 2, borderColor: "#D97706" }]}>
                    <Text style={{ fontSize: 16, fontWeight: "700", textAlign: "center", color: "#78350F", paddingVertical: 12 }}>
                      📋 Already Assigned - Complete First
                    </Text>
                  </Surface>
                ) : (
                  <Button 
                    mode="contained" 
                    onPress={() => {
                      if (isAlreadyAssigned()) {
                        Alert.alert("Cannot Assign", "This chapter is already assigned to you. Please complete it first.");
                      } else {
                        setShowAssignModal(true);
                      }
                    }} 
                    style={[styles.assignButton, { marginVertical: 12 }]}
                  >
                    📚 Assign This Chapter
                  </Button>
                )}
              </View>
            )}
          </View>

          {chapterDetail.sections.map((section) => (
            <View key={section.section_type} style={styles.sectionContainer}>
              {section.section_type !== "General" && (
                <Text style={styles.sectionHeader}>{section.section_type}</Text>
              )}

              {section.topics.map((topic) => (
                <View key={topic.topic_name} style={styles.topicContainer}>
                  <Text style={styles.topicTitle}>{topic.topic_name}</Text>

                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCell, styles.headerCell, styles.subtopicCol]}>Subtopic</Text>
                    <Text style={[styles.tableCell, styles.headerCell, styles.activityCol]}>Activity</Text>
                    <Text style={[styles.tableCell, styles.headerCell, styles.daysCol]}>Days</Text>
                    {!isMobile && <Text style={[styles.tableCell, styles.headerCell, styles.dateCol]}>Planned Date</Text>}
                    {!isMobile && <Text style={[styles.tableCell, styles.headerCell, styles.dateCol]}>Completed Date</Text>}
                    <Text style={[styles.tableCell, styles.headerCell, styles.statusCol]}>Status</Text>
                  </View>

                  {/* Table Rows */}
                  {topic.subtopics.map((subtopic, idx) => (
                    <View key={`${subtopic.chapter_no}-${subtopic.topic_name || topic.topic_name}-${subtopic.sub_topic}-${idx}`} style={styles.subtopicRow}>
                      <Text style={[styles.tableCell, styles.subtopicCol]}>{subtopic.sub_topic}</Text>
                      <Text style={[styles.tableCell, styles.activityCol]}>{subtopic.activity || '-'}</Text>
                      <Text style={[styles.tableCell, styles.daysCol]}>{subtopic.lec_required || 0}</Text>
                      {!isMobile && <Text style={[styles.tableCell, styles.dateCol]}>{subtopic.planned_date || '-'}</Text>}
                      {!isMobile && <Text style={[styles.tableCell, styles.dateCol]}>{subtopic.completed_date || '-'}</Text>}
                      <View style={[styles.tableCell, styles.statusCol]}>
                        {viewContext === "assigned" ? (
                          subtopic.status === "completed" ? (
                            <Text style={styles.completedLabel}>✅ Completed</Text>
                          ) : (
                            <Button
                              mode="outlined"
                              compact
                              onPress={handleMarkSubtopicComplete(topic.topic_name, subtopic.sub_topic)}
                              style={styles.doneButton}
                            >
                              Done
                            </Button>
                          )
                        ) : subtopic.status === "completed" ? (
                          <Text style={styles.completedLabel}>✅ Completed</Text>
                        ) : (
                          <Text style={styles.pendingLabel}>⏳ Not assigned</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderMyChaptersView = () => {
    // In "My Chapters" view, show all assigned chapters regardless of selected subject
    const filteredChapters = assignedChapters.length > 0 ? assignedChapters : userChapters;
    console.log("renderMyChaptersView - filteredChapters", filteredChapters.length, filteredChapters);

    return (
      <View>
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, view === "subjects" && styles.activeTab]} onPress={() => setView("subjects")}> 
            <Text style={[styles.tabText, view === "subjects" && styles.activeTabText]}>Browse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, view === "my-chapters" && styles.activeTab]} onPress={() => setView("my-chapters")}> 
            <Text style={[styles.tabText, view === "my-chapters" && styles.activeTabText]}>My Chapters ({filteredChapters.length})</Text>
          </TouchableOpacity>
        </View>

        {filteredChapters.length === 0 ? (
          <Surface style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {selectedSubject ? `No assigned chapters for ${selectedSubject.subject_name}` : "No assigned chapters yet"}
            </Text>
          </Surface>
        ) : (
          <FlatList
            data={filteredChapters}
            renderItem={({ item }) => {
              const progress =
                item.total_subtopics && item.total_subtopics > 0
                  ? item.completed_subtopics / item.total_subtopics
                  : 0;
              return (
                <TouchableOpacity onPress={() => handleSelectAssignedChapter(item)}>
                  <Surface style={styles.chapterProgressCard}>
                    <Text style={styles.cardTitle}>{item.chapter_name}</Text>
                    <Text style={styles.cardSubtitle}>
                      Chapter {item.chapter_no} | {item.class_name} - {item.subject_name}
                    </Text>

                    <View style={styles.progressContainer}>
                      <ProgressBar progress={progress} style={styles.progressBar} />
                      <Text style={styles.progressText}>
                        {item.completed_subtopics}/{item.total_subtopics} subtopics
                      </Text>
                    </View>
                  </Surface>
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) =>
              item.progress_id
                ? item.progress_id.toString()
                : `${item.class_subject_id}_${item.chapter_no}_${item.subject_id}`
            }
            nestedScrollEnabled={true}
            scrollEnabled={true}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}
      </View>
    );
  };

  const renderAssignModal = () => {
    // Format date to dd/mm/yyyy
    const formatDateForDisplay = (dateStr) => {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };

    return (
      <Modal visible={showAssignModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalContent}>
            <Text style={styles.modalTitle}>📚 Assign Chapter</Text>
            
            <Text style={styles.modalLabel}>Start Date</Text>
            <View style={styles.dateDisplayContainer}>
              <Text style={styles.dateDisplayText}>{formatDateForDisplay(startDate)}</Text>
            </View>

            <Text style={styles.modalDescription}>Today's date has been set as your start date.</Text>

            <View style={styles.modalButtonsRow}>
              <Button 
                mode="contained" 
                onPress={handleAssignChapter} 
                loading={loading} 
                style={{ flex: 1, marginRight: 8 }}
              >
                Confirm
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => setShowAssignModal(false)} 
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          padding: isMobile ? 0 : 12,
          paddingBottom: insets.bottom + 10,
        }}
      >
        <Text style={styles.screenTitle}>My Lesson Plans</Text>
        {view === "subjects" && renderSubjectsView()}
        {view === "sections-with-chapters" && renderSectionsWithChaptersView()}
        {view === "chapter-detail" && renderChapterDetailView()}
        {view === "my-chapters" && renderMyChaptersView()}
      </ScrollView>

      {renderAssignModal()}
    </SafeAreaView>
  );
}

const fontSystem = { 
  fontFamily: Platform.select({
    ios: "SF Pro Display",
    android: "Roboto",
    default: "System",
  })
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 20,
    color: "#0F172A",
    letterSpacing: -0.5,
    ...fontSystem,
  },
  tabBar: {
    flexDirection: "row",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#E2E8F0",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#2196F3",
    backgroundColor: "#E3F2FD",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.2,
    ...fontSystem,
  },
  activeTabText: {
    color: "#3B82F6",
    fontWeight: "800",
    ...fontSystem,
  },
  backButton: {
    marginBottom: 16,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginHorizontal: 12,
    marginBottom: 12,
    color: "#0F172A",
    letterSpacing: -0.5,
    ...fontSystem,
  },
  chapterHeaderContainer: {
    marginHorizontal: 8,
    marginBottom: 16,
  },
  chapterTitleSection: {
    marginBottom: 12,
  },
  assignButtonTopSection: {
    paddingHorizontal: 4,
  },
  subjectCard: {
    marginHorizontal: 8,
    marginBottom: 12,
  },
  chapterCard: {
    marginHorizontal: 8,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  chapterProgressCard: {
    marginHorizontal: 8,
    marginBottom: 12,
    padding: 18,
    borderRadius: 12,
    elevation: 4,
    backgroundColor: "#FFFFFF",
    shadowColor: "#1F2937",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderLeftWidth: 5,
    borderLeftColor: "#06B6D4",
  },
  cardContent: {
    borderRadius: 12,
    padding: 18,
    backgroundColor: "#FFFFFF",
    elevation: 4,
    shadowColor: "#1F2937",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderTopWidth: 3,
    borderTopColor: "#3B82F6",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
    ...fontSystem,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    fontWeight: "500",
    ...fontSystem,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    ...fontSystem,
  },
  sectionCard: {
    marginVertical: 12,
    marginHorizontal: 8,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#1F2937",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
    textTransform: "capitalize",
    letterSpacing: 0.3,
    ...fontSystem,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  chaptersContainer: {
    marginLeft: 16,
    marginTop: 8,
  },
  noChaptersCard: {
    marginLeft: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 16,
    textTransform: "capitalize",
    ...fontSystem,
  },
  topicContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
    elevation: 1,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
    letterSpacing: 0.2,
    ...fontSystem,
  },
  subtopicContainer: {
    marginBottom: 12,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: "#E2E8F0",
  },
  subtopicText: {
    fontSize: 14,
    color: "#1E293B",
    marginBottom: 6,
    fontWeight: "500",
    ...fontSystem,
    lineHeight: 20,
  },
  activityText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 6,
    fontStyle: "italic",
    fontWeight: "500",
    ...fontSystem,
  },
  dateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
    gap: 12,
  },
  dateText: {
    fontSize: 12,
    color: "#475569",
    ...fontSystem,
  },
  statusContainer: {
    marginTop: 8,
  },
  doneButton: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingVertical: 2,
  },
  assignButton: {
    marginHorizontal: 8,
    marginVertical: 12,
    borderRadius: 10,
  },
  progressContainer: {
    marginVertical: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 10,
    backgroundColor: "#E2E8F0",
  },
  progressText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "right",
    ...fontSystem,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 16,
    padding: 28,
    width: "85%",
    backgroundColor: "#FFFFFF",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 20,
    letterSpacing: -0.5,
    ...fontSystem,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 10,
    letterSpacing: 0.2,
    ...fontSystem,
  },
  modalInput: {
    marginBottom: 20,
    backgroundColor: "#F8FAFC",
  },
  dateDisplayContainer: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dateDisplayText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.5,
    ...fontSystem,
  },
  modalDescription: {
    fontSize: 13,
    color: "#64748B",
    fontStyle: "italic",
    marginBottom: 20,
    textAlign: "center",
    ...fontSystem,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  emptyState: {
    padding: 40,
    borderRadius: 12,
    alignItems: "center",
    elevation: 2,
    marginHorizontal: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyText: {
    textAlign: "center",
    color: "#78716C",
    fontSize: 15,
    fontWeight: "600",
    ...fontSystem,
  },
  completedLabel: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "700",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: "hidden",
    ...fontSystem,
  },
  pendingLabel: {
    fontSize: 13,
    color: "#D97706",
    fontWeight: "700",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: "hidden",
    ...fontSystem,
  },
  lectureText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
    ...fontSystem,
  },
  markCompleteButton: {
    marginTop: 12,
  },
  topicSection: {
    marginVertical: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 3,
    borderLeftColor: "#2196F3",
  },
  subtopicItem: {
    marginLeft: 12,
    marginBottom: 8,
    paddingVertical: 6,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#3B82F6",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    elevation: 2,
  },
  tableCell: {
    fontSize: 12,
    color: "#334155",
    flexWrap: "wrap",
    paddingVertical: 6,
    paddingHorizontal: 4,
    ...fontSystem,
  },
  subtopicCol: {
    flex: 2,
    minWidth: 100,
  },
  activityCol: {
    flex: 1.5,
    minWidth: 80,
  },
  daysCol: {
    flex: 0.8,
    minWidth: 50,
    textAlign: "center",
  },
  dateCol: {
    flex: 1.2,
    minWidth: 70,
  },
  statusCol: {
    flex: 0.7,
    minWidth: 50,
  },
  headerCell: {
    fontWeight: "700",
    color: "#FFFFFF",
    ...fontSystem,
  },
  subtopicRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FAFBFC",
    borderRadius: 6,
  },
});


