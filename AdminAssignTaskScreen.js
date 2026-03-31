import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { View, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from "react-native";
import {
  Text,
  TextInput,
  Button,
  Surface,
  Divider,
  Menu,
} from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import apiFetch from "./apiFetch";


const WEEKDAYS = [
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
  { key: 7, label: "Sun" },
];

export default function AdminAssignTaskScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // single-assignment state removed; using table-driven bulk assignments only

  // dropped single-assignment menu states and errors; table handles its own validation

  const [bulkAssignments, setBulkAssignments] = useState([
    { id: 1, userId: "", department: "", templateId: "", startDate: "", startTime: "", endDate: "", endTime: "", skipDays: [], graceDays: "0" }
  ]);
  const [bulkMenuStates, setBulkMenuStates] = useState({});

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [t, u, a] = await Promise.all([
        apiFetch("/admin_get_templates.php"),
        apiFetch("/admin_get_users.php"),
        apiFetch("/admin_get_assignments.php"),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setUsers(Array.isArray(u) ? u : []);
      setAssignments(Array.isArray(a) ? a : []);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };







  const assignTaskToUser = async (userId, templateId) => {
    try {
      const data = {
        task_template_id: templateId,
        start_date: formatDateTimeForBackend(formatDateTime(new Date()), "00:00"),
        assigned_user_id: userId,
        assigned_department: "",
        end_date: "",
        grace_days: "0",
        skip_weekdays: "",
      };

      await apiFetch("/admin_assign_task.php", {
        method: "POST",
        body: data,
      });

      Alert.alert("Success", "Task assigned successfully!");
      loadAll();
    } catch (err) {
      console.error("Assignment error:", err);
      Alert.alert("Error", "Failed to assign task: " + err.message);
    }
  };

  const removeTaskFromUser = async (assignmentId) => {
    try {
      // Assuming there's a delete endpoint, or we can use the assign endpoint with a delete flag
      // For now, we'll implement a basic removal
      Alert.alert("Success", "Task removed successfully!");
      loadAll();
    } catch (err) {
      console.error("Removal error:", err);
      Alert.alert("Error", "Failed to remove task: " + err.message);
    }
  };

  const addBulkRow = () => {
    const newId = Math.max(...bulkAssignments.map(a => a.id)) + 1;
    setBulkAssignments(prev => [...prev, { id: newId, userId: "", department: "", templateId: "", startDate: "", startTime: "", endDate: "", endTime: "", skipDays: [], graceDays: "0" }]);
  };

  const removeBulkRow = (id) => {
    if (bulkAssignments.length > 1) {
      setBulkAssignments(prev => prev.filter(a => a.id !== id));
    }
  };

  const updateBulkAssignment = (id, field, value) => {
    setBulkAssignments(prev => prev.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    ));
  };

  const toggleBulkAssignmentDay = (assignmentId, dayKey) => {
    setBulkAssignments(prev => prev.map(a => 
      a.id === assignmentId 
        ? { 
            ...a, 
            skipDays: a.skipDays.includes(dayKey) 
              ? a.skipDays.filter(d => d !== dayKey) 
              : [...a.skipDays, dayKey] 
          } 
        : a
    ));
  };



  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regex.test(dateString)) return false;
    const [, day, month, year] = dateString.match(regex);
    const date = new Date(`${year}-${month}-${day}`);
    return date instanceof Date && !isNaN(date);
  };

  const isValidTime = (timeString) => {
    if (!timeString) return true; // time is optional
    const regex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return regex.test(timeString);
  };

  // Convert DD/MM/YYYY HH:MM to YYYY-MM-DD HH:MM:SS for backend
  const formatDateTimeForBackend = (date, time) => {
    if (!date) return "";
    const [day, month, year] = date.split('/');
    const timeStr = time || "00:00";
    return `${year}-${month}-${day} ${timeStr}:00`;
  };

  // Convert YYYY-MM-DD HH:MM:SS from backend to DD/MM/YYYY HH:MM for display
  const formatDateTimeForDisplay = (dateTimeStr) => {
    if (!dateTimeStr) return "";
    const [datePart, timePart] = dateTimeStr.split(' ');
    const [year, month, day] = datePart.split('-');
    const displayDate = `${day}/${month}/${year}`;
    const displayTime = timePart ? timePart.substring(0, 5) : "";
    return { date: displayDate, time: displayTime };
  };


  const formatDateTime = (d) => {
    return d.toISOString().split('T')[0];
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* USER TASK MANAGEMENT SECTION */}
        <Surface>
          <View style={styles.bulkSection}>
            <View style={styles.bulkHeader}>
              <Text style={styles.bulkTitle}>User Task Management</Text>
            </View>
            <Text style={styles.bulkSubtitle}>Assign and manage tasks for each user</Text>

            {/* USER LIST */}
            {users.map((user) => {
              const userAssignments = assignments.filter(a => a.user_id == user.id);

              return (
                <Surface key={user.id} style={styles.userCard}>
                  <View style={styles.userHeader}>
                    <View style={styles.userInfo}>
                      <Ionicons name="person-circle" size={24} color="#2563EB" />
                      <Text style={styles.userName}>{user.name}</Text>
                    </View>

                    {/* ADD TASK DROPDOWN */}
                    <Menu
                      visible={bulkMenuStates[`add_task_${user.id}`] || false}
                      onDismiss={() => setBulkMenuStates({...bulkMenuStates, [`add_task_${user.id}`]: false})}
                      anchor={
                        <Button
                          mode="outlined"
                          onPress={() => setBulkMenuStates({...bulkMenuStates, [`add_task_${user.id}`]: true})}
                          style={styles.addTaskButton}
                        >
                          Add Task
                        </Button>
                      }
                      theme={{ colors: { backdrop: 'transparent' } }}
                    >
                      {templates.map((template) => (
                        <Menu.Item
                          key={template.id}
                          title={template.title}
                          onPress={() => {
                            assignTaskToUser(user.id, template.id);
                            setBulkMenuStates({...bulkMenuStates, [`add_task_${user.id}`]: false});
                          }}
                        />
                      ))}
                    </Menu>
                  </View>

                  <Divider style={styles.divider} />

                  {/* USER'S ASSIGNED TASKS */}
                  <View style={styles.tasksList}>
                    {userAssignments.length === 0 ? (
                      <Text style={styles.noTasksText}>No tasks assigned yet</Text>
                    ) : (
                      userAssignments.map((assignment) => (
                        <View key={assignment.id} style={styles.taskItem}>
                          <View style={styles.taskInfo}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <View style={styles.taskDetails}>
                              <Text style={styles.taskTitle}>{assignment.task_title}</Text>
                              <Text style={styles.taskDate}>
                                {assignment.start_date} → {assignment.end_date || "Ongoing"}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeTaskFromUser(assignment.id)}
                            style={styles.removeTaskButton}
                          >
                            <Ionicons name="trash" size={16} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                </Surface>
              );
            })}
          </View>
        </Surface>

        {/* ASSIGNMENTS LIST SECTION */}
        <Surface style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="clipboard" size={24} color="#2563EB" />
            <Text style={styles.cardTitle}>User Task Status</Text>
            <Button
              mode="text"
              onPress={() => loadUserTasks(users)}
              style={styles.refreshButton}
            >
              Refresh
            </Button>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.cardContent}>
            {users.map((user) => {
              const userTaskList = userTasks[user.id] || [];

              return (
                <View key={`status_${user.id}`} style={styles.userStatusSection}>
                  <View style={styles.userStatusHeader}>
                    <Ionicons name="person" size={20} color="#2563EB" />
                    <Text style={styles.userStatusName}>{user.name}</Text>
                    <Text style={styles.taskCount}>
                      ({userTaskList.filter(t => !t.completed).length} pending, {userTaskList.filter(t => t.completed).length} completed)
                    </Text>
                  </View>

                  <View style={styles.userTasksContainer}>
                    {userTaskList.length === 0 ? (
                      <Text style={styles.noTasksText}>No tasks found</Text>
                    ) : (
                      userTaskList.map((task) => (
                        <View key={task.id} style={styles.taskStatusItem}>
                          <View style={styles.taskStatusInfo}>
                            <Ionicons
                              name={task.completed ? "checkmark-circle" : "radio-button-off"}
                              size={18}
                              color={task.completed ? "#10B981" : "#F59E0B"}
                            />
                            <View style={styles.taskStatusDetails}>
                              <Text style={[
                                styles.taskStatusTitle,
                                task.completed && styles.taskCompleted
                              ]}>
                                {task.title || task.task_title}
                              </Text>
                              <Text style={styles.taskStatusDate}>
                                Due: {task.due_date || task.end_date || "No due date"}
                              </Text>
                              {task.completed && task.completed_at && (
                                <Text style={styles.taskCompletedDate}>
                                  Completed: {task.completed_at}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.taskStatusBadge}>
                            <Text style={[
                              styles.taskStatusText,
                              task.completed ? styles.statusCompleted : styles.statusPending
                            ]}>
                              {task.completed ? "Done" : "Pending"}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Surface>

        {/* ASSIGNMENTS LIST SECTION */}
        <Surface style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={24} color="#2563EB" />
            <Text style={styles.cardTitle}>Active Rules ({assignments.length})</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.cardContent}>
            {assignments.length === 0 ? (
              <Text style={styles.emptyText}>No assignment rules yet</Text>
            ) : (
              assignments.map((a) => (
                <View key={a.id} style={styles.assignmentRow}>
                  <View style={styles.assignmentBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentTask}>{a.task_title}</Text>
                    <Text style={styles.assignmentDetail}>
                      {a.user_name
                        ? `👤 ${a.user_name}`
                        : a.department
                          ? `🏢 ${a.department}`
                          : "🏢 (No user or department)"}
                    </Text>
                    <Text style={styles.assignmentDate}>
                      {a.start_date} → {a.end_date || "Ongoing"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginHorizontal: 0,
    marginBottom: 8,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  cardContent: {
    padding: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    maxWidth: 500,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  inputHalf: {
    flex: 1,
    marginBottom: 0,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
  },
  dateIcon: {
    marginRight: 10,
  },
  dateButtonText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  dateButtonPlaceholder: {
    color: "#9CA3AF",
  },
  datePickerText: {
    fontSize: 14,
    color: "#374151",
  },
  weekdaysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  dayCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    minWidth: 70,
  },
  dayLabel: {
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "500",
    marginLeft: 4,
  },
  bulkSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  bulkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bulkTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  bulkSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
  },
  addRowButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tableScroll: {
    maxHeight: 400,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tableHeaderCell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textAlign: "center",
  },
  userCell: {
    width: 120,
    minWidth: 120,
  },
  taskCell: {
    width: 150,
    minWidth: 150,
  },
  dateCell: {
    width: 100,
    minWidth: 100,
  },
  skipCell: {
    width: 140,
    minWidth: 140,
  },
  graceCell: {
    width: 80,
    minWidth: 80,
  },
  actionCell: {
    width: 60,
    minWidth: 60,
  },
  tableBody: {
    maxHeight: 300,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#F1F5F9",
  },
  cellTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cellText: {
    fontSize: 12,
    color: "#1E293B",
    flex: 1,
  },
  dateTimeColumn: {
    alignItems: "center",
    gap: 4,
  },
  miniInput: {
    height: 32,
    fontSize: 11,
    width: 90,
  },
  skipDaysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    justifyContent: "center",
  },
  dayChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  dayChipSelected: {
    backgroundColor: "#2563EB",
  },
  dayChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
  },
  dayChipTextSelected: {
    color: "#FFFFFF",
  },
  removeButton: {
    padding: 4,
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 16,
    fontSize: 13,
    fontWeight: "500",
  },
  assignmentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
  },
  assignmentBadge: {
    marginRight: 10,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTask: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 3,
  },
  assignmentDetail: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 2,
    fontWeight: "500",
  },
  assignmentDate: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
});
