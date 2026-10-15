"use client";

import { Component, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import DashboardSectionState from "@/src/components/AdminDashboardSectionState";
import type { DashboardSectionId } from "@/src/lib/services/admin-dashboard-section";

export default class AdminDashboardRenderBoundary extends Component<{ id: DashboardSectionId; title: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(error: unknown) {
    unstable_rethrow(error);
    return { failed: true };
  }

  componentDidCatch() {
    console.error("admin_dashboard_render_unavailable", { section: this.props.id });
  }

  render() {
    return this.state.failed ? <DashboardSectionState title={this.props.title} /> : this.props.children;
  }
}
