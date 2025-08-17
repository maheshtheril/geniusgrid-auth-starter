// src/components/ui/Icon.jsx
import React from "react";
import {
  // add only what your app uses
  User, Settings, Sun, Menu as MenuIcon, Plus, Search,
  Building2, BarChart3, Activity, ShieldAlert, RefreshCw,
  CheckCircle2, Phone, Mail, CalendarDays, User2, Flag, Info,
  Calendar, Edit3, HelpCircle, ArrowLeft, Briefcase, Upload, Download, Filter,
  Trophy, Settings2, CircleHelp, SlidersHorizontal, Bell, Users, CheckSquare,
} from "lucide-react";

const ICONS = {
  User, Settings, Sun, MenuIcon, Plus, Search,
  Building2, BarChart3, Activity, ShieldAlert, RefreshCw,
  CheckCircle2, Phone, Mail, CalendarDays, User2, Flag, Info,
  Calendar, Edit3, HelpCircle, ArrowLeft, Briefcase, Upload, Download, Filter,
  Trophy, Settings2, CircleHelp, SlidersHorizontal, Bell, Users, CheckSquare,
};

export function Icon({ name, ...props }) {
  const Cmp = ICONS[name] ?? CircleHelp;
  return <Cmp {...props} />;
}

export default Icon;
