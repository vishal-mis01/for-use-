import React, { useState } from "react";
import { View, StyleSheet, useWindowDimensions, ScrollView, Modal, TouchableOpacity } from "react-native";
import {
  Text,
  Button,
  Avatar,
  Surface,
  Menu,
} from "react-native-paper";

import AdminCreateTaskScreen from "./AdminCreateTaskScreen";
import AdminAssignTaskScreen from "./AdminAssignTaskScreen";
import AdminHolidayScreen from "./AdminHolidayScreen";
import AdminReportsScreen from "./AdminReportsScreen";

import AdminFmsBuilder from "./AdminFmsBuilder";
import AdminFmsView from "./AdminFmsView";

import AdminFormBuilder from "./AdminFormBuilder";
import FormResponsesViewer from "./FormResponsesViewer";
import CreateUserScreen from "./CreateUserScreen";
import SelectFormScreen from "./SelectFormScreen";
import AdminClassesScreen from "./AdminClassesScreen";
import AdminSubjectsScreen from "./AdminSubjectsScreen";
import AdminUserAccessScreen from "./AdminUserAccessScreen";
import AdminSyllabusUploadScreen from "./AdminSyllabusUploadScreen";

export default function AdminDashboard({ onLogout }) {
  const [active, setActive] = useState("tasks");
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [navMenuVisible, setNavMenuVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // on web, react-native-paper inserts a backdrop div that captures clicks.
  // inject global CSS to make it transparently non‑interactive.
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.innerHTML = `
        .react-native-paper__backdrop {
          pointer-events: none !important;
          background-color: transparent !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const renderContent = () => {
    switch (active) {
      case "assign":
        return <AdminAssignTaskScreen />;
      case "holidays":
        return <AdminHolidayScreen />;
      case "reports":
        return <AdminReportsScreen />;
      case "fms_view":
        return <AdminFmsView />;
      case "fms_builder":
        return <AdminFmsBuilder />;
      case "forms":
        return <AdminFormBuilder />;
      case "classes":
        return <AdminClassesScreen />;
      case "subjects":
        return <AdminSubjectsScreen />;
      case "user_access":
        return <AdminUserAccessScreen />;
      case "syllabus_upload":
        return <AdminSyllabusUploadScreen />;
      case "create_user":
        return <CreateUserScreen user={{ user_id: 1, role: 'admin' }} />;
      case "form_responses":
        return selectedFormId ? (
          <FormResponsesViewer formId={selectedFormId} onBack={() => setSelectedFormId(null)} />
        ) : (
          <SelectFormScreen onSelect={setSelectedFormId} />
        );
      case "tasks":
      default:
        return <AdminCreateTaskScreen />;
    }
  };

  const getHeaderTitle = () => {
    switch (active) {
      case "assign":
        return "Assignment Rules";
      case "holidays":
        return "Holidays";
      case "reports":
        return "User Reports";
      case "fms_view":
        return "FMS Overview";
      case "fms_builder":
        return "FMS Process Builder";
      case "forms":
        return "Form Builder";
      case "classes":
        return "Classes";
      case "subjects":
        return "Subjects";
      case "user_access":
        return "User Access Control";
      case "syllabus_upload":
        return "Syllabus Upload";
      default:
        return "Tasks";
    }
  };

  const navItems = [
    { key: "tasks", title: "Tasks" },
    { key: "form_responses", title: "Form Responses" },
    { key: "assign", title: "Assignment Rules" },
    { key: "fms_view", title: "FMS Overview" },
    { key: "fms_builder", title: "FMS Builder" },
    { key: "forms", title: "Forms" },
    { key: "classes", title: "Classes" },
    { key: "subjects", title: "Subjects" },
    { key: "user_access", title: "User Access" },
    { key: "syllabus_upload", title: "Syllabus Upload" },
    { key: "holidays", title: "Holidays" },
    { key: "reports", title: "Reports" },
    { key: "create_user", title: "Create User" },
  ];

  const renderNavItem = ({ key, title }) => (
    <TouchableOpacity
      key={key}
      style={styles.menuItem}
      onPress={() => {
        setActive(key);
        setNavMenuVisible(false);
      }}
    >
      <Text style={styles.menuItemText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.outerWrapper}>
      <View style={styles.mobileContainerWrapper}>
        <View style={styles.mobileContainer}>
          {/* HEADER */}
          <Surface style={styles.header} elevation={2}>
            <View style={styles.headerLeft}>
              <Button
                icon="menu"
                onPress={() => setNavMenuVisible(!navMenuVisible)}
                compact
              />

              <Text variant="titleLarge">{getHeaderTitle()}</Text>

              <Modal
                visible={navMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setNavMenuVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalMenu}>
                    <ScrollView
                      style={styles.menuScroll}
                      contentContainerStyle={styles.menuScrollContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {navItems.map(renderNavItem)}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            </View>
            <View style={styles.profile}>
              <Text>Admin</Text>
              <Avatar.Text size={36} label="A" />
              <Button mode="outlined" compact onPress={onLogout}>Logout</Button>
            </View>
          </Surface>
          {/* CONTENT */}
          <ScrollView
            style={[styles.mobileContentScroll, {flex: 1, minHeight: 0}]}
            contentContainerStyle={{flexGrow: 1, minHeight: 0}}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
          >
            <View style={styles.mobileContent}>{renderContent()}</View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function SidebarItem({ icon, label, active, onPress, showLabel }) {
  return (
    <Button
      icon={icon}
      mode={active ? "contained" : "text"}
      onPress={onPress}
      style={styles.sidebarBtn}
      contentStyle={{
        justifyContent: showLabel ? "flex-start" : "center",
      }}
      textColor={active ? "#fff" : "#c7d2fe"}
      buttonColor={active ? "#2563eb" : "transparent"}
    >
      {showLabel ? label : ""}
    </Button>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    paddingTop: 30,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#F8FAFC',
  },
  // Remove containerWeb
    mobileContainerWrapper: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      height: '100vh',
      backgroundColor: '#F8FAFC',
      overflow: 'auto',
    },
    mobileContainer: {
      width: 420,
      maxWidth: '100vw',
      minHeight: '100vh',
      height: '100vh',
      backgroundColor: '#fff',
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      borderRadius: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      overflow: 'auto',
    },
    mobileContentScroll: {
      flex: 1,
      overflowX: 'auto',
      width: '100%',
      backgroundColor: 'transparent',
    },
    mobileContent: {
      minWidth: 320,
      maxWidth: 420,
      width: '100%',
      margin: 0,
      padding: 0,
      backgroundColor: 'transparent',
    },
  sidebar: {
    display: 'none',
    backgroundColor: "#1E293B",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  brandText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sidebarBtn: {
    marginVertical: 4,
    borderRadius: 10,
  },
  main: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 0,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 24,
  },
  contentMobile: {
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalMenu: {
    width: 260,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 8,
  },
  menuScroll: {
    maxHeight: 340,
  },
  menuScrollContent: {
    padding: 12,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#F7F9FC",
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
});
