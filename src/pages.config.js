/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AcceptInvite from './pages/AcceptInvite';
import AddOnsSettings from './pages/AddOnsSettings';
import ArchivedRecords from './pages/ArchivedRecords';
import Calendar from './pages/Calendar';
import ClientPortal from './pages/ClientPortal';
import ContactDetail from './pages/ContactDetail';
import ContactForm from './pages/ContactForm';
import Contacts from './pages/Contacts';
import Contracts from './pages/Contracts';
import DJDetail from './pages/DJDetail';
import DJRoster from './pages/DJRoster';
import DJView from './pages/DJView';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import EventForm from './pages/EventForm';
import Events from './pages/Events';
import FinalizerQueue from './pages/FinalizerQueue';
import ForgotPassword from './pages/ForgotPassword';
import LeadDetail from './pages/LeadDetail';
import LeadForm from './pages/LeadForm';
import Leads from './pages/Leads';
import MessageTemplates from './pages/MessageTemplates';
import MusicPlanner from './pages/MusicPlanner';
import PackagesSettings from './pages/PackagesSettings';
import Payments from './pages/Payments';
import ReportBuilder from './pages/ReportBuilder';
import Reports from './pages/Reports';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';
import StaffMusicManager from './pages/StaffMusicManager';
import StaffPlanningHub from './pages/StaffPlanningHub';
import StaffPrint from './pages/StaffPrint';
import StaffSpecialSongsList from './pages/StaffSpecialSongsList';
import StaffTimelineManager from './pages/StaffTimelineManager';
import StaffTimelineView from './pages/StaffTimelineView';
import StatusSettings from './pages/StatusSettings';
import Tasks from './pages/Tasks';
import TimelineBuilder from './pages/TimelineBuilder';
import TimelineTemplateBuilder from './pages/TimelineTemplateBuilder';
import TimelineTemplates from './pages/TimelineTemplates';
import UserForm from './pages/UserForm';
import Users from './pages/Users';
import Venues from './pages/Venues';
import FinancePayments from './pages/FinancePayments';
import FinanceIncoming from './pages/FinanceIncoming';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AcceptInvite": AcceptInvite,
    "AddOnsSettings": AddOnsSettings,
    "ArchivedRecords": ArchivedRecords,
    "Calendar": Calendar,
    "ClientPortal": ClientPortal,
    "ContactDetail": ContactDetail,
    "ContactForm": ContactForm,
    "Contacts": Contacts,
    "Contracts": Contracts,
    "DJDetail": DJDetail,
    "DJRoster": DJRoster,
    "DJView": DJView,
    "Dashboard": Dashboard,
    "EventDetail": EventDetail,
    "EventForm": EventForm,
    "Events": Events,
    "FinalizerQueue": FinalizerQueue,
    "ForgotPassword": ForgotPassword,
    "LeadDetail": LeadDetail,
    "LeadForm": LeadForm,
    "Leads": Leads,
    "MessageTemplates": MessageTemplates,
    "MusicPlanner": MusicPlanner,
    "PackagesSettings": PackagesSettings,
    "Payments": Payments,
    "ReportBuilder": ReportBuilder,
    "Reports": Reports,
    "ResetPassword": ResetPassword,
    "Settings": Settings,
    "StaffMusicManager": StaffMusicManager,
    "StaffPlanningHub": StaffPlanningHub,
    "StaffPrint": StaffPrint,
    "StaffSpecialSongsList": StaffSpecialSongsList,
    "StaffTimelineManager": StaffTimelineManager,
    "StaffTimelineView": StaffTimelineView,
    "StatusSettings": StatusSettings,
    "Tasks": Tasks,
    "TimelineBuilder": TimelineBuilder,
    "TimelineTemplateBuilder": TimelineTemplateBuilder,
    "TimelineTemplates": TimelineTemplates,
    "UserForm": UserForm,
    "Users": Users,
    "Venues": Venues,
    "FinancePayments": FinancePayments,
    "FinanceIncoming": FinanceIncoming,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};