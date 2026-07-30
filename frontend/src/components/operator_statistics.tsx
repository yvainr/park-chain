import { useEffect, useState } from "react";
import { parkingLedgerAbi } from "../abi/contracts";
import { readContract, toUint } from "../lib/wallet";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui";
import { PeakUsageChart } from "./charts/PeakUsageChart";
import { CompletionChart } from "./charts/CompletionChart";
import { NoShowChart } from "./charts/NoShowChart";
import { StatusPieChart } from "./charts/StatusPieChart";
import { CategoryPieChart } from "./charts/CategoryPieChart";

type Statistics = {
    reservations: number;
    completionRate: number;
    bookedHours: number;
    averageDuration: number;
    mostPopularCategory: string;
    noShowRate: number;
    peakHour: string;
    categoryDistribution: {
        name: string;
        value: number;
    }[];
    hourlyDistribution: {
        hour: string;
        reservations: number;
    }[];
    statusDistribution: {
        Reserved: number;
        CheckedIn: number;
        CheckedOut: number;
        Cancelled: number;
        NoShow: number;
    };
};

export function OperatorStatistics({ app }: any) {
  const [stats, setStats] = useState<Statistics>({
    reservations: 0,
    completionRate: 0,
    bookedHours: 0,
    averageDuration: 0,
    mostPopularCategory: "-",
    noShowRate: 0,
    peakHour: "-",
    categoryDistribution: [],
    hourlyDistribution: [],
    statusDistribution: {
        Reserved: 0,
        CheckedIn: 0,
        CheckedOut: 0,
        Cancelled: 0,
        NoShow: 0,
    },
});

  async function loadStatistics() {
    if (!app.operatorId) return;
    const operatorId = toUint(app.operatorId, "Operator ID");
    const reservations = await readContract({
      address: app.requireLedger(),
      abi: parkingLedgerAbi,
      functionName: "getOperatorReservations",
      args: [operatorId],
    }) as any[];
    let bookedHours = 0;
    let reserved = 0;
    let checkedIn = 0;
    let checkedOut = 0;
    let cancelled = 0;
    let noShows = 0;
    const categoryCounter: Record<string, number> = {};
    const hourCounter: Record<number, number> = {};
    reservations.forEach((reservation) => {
      bookedHours += Number(reservation.duration);
      switch (Number(reservation.status)) {
        case 0:
          reserved++;
          break;
        case 1:
          checkedIn++;
          break;
        case 2:
          checkedOut++;
          break;
        case 3:
          cancelled++;
          break;
        case 4:
          noShows++;
          break;
      }
      const category =
        app.categoryNameFromHash
          ? app.categoryNameFromHash(reservation.category)
          : reservation.category;
      categoryCounter[category] =
        (categoryCounter[category] ?? 0) + 1;
      const hour =
        new Date(Number(reservation.startTime) * 1000).getHours();
      hourCounter[hour] =
        (hourCounter[hour] ?? 0) + 1;
    });

    let mostPopularCategory = "-";
    let maxCategory = 0;
    Object.entries(categoryCounter).forEach(([name, count]) => {
      if (count > maxCategory) {
        maxCategory = count;
        mostPopularCategory = name;
      }
    });
    let peakHour = "-";
    let maxHour = 0;
    Object.entries(hourCounter).forEach(([hour, count]) => {
      if (count > maxHour) {
        maxHour = count;
        peakHour = `${hour}:00`;
      }
    });
    const averageDuration =
      reservations.length === 0
        ? 0
        : Number(
            (
              bookedHours /
              reservations.length
            ).toFixed(1)
          );
    const completionRate =
      reservations.length === 0
        ? 0
        : Math.round(
            checkedOut /
            reservations.length *
            100
          );
    const noShowRate =
      reservations.length === 0
        ? 0
        : Math.round(
            noShows /
            reservations.length *
            100
          );
    const categoryDistribution =
      Object.entries(categoryCounter).map(
          ([name, value]) => ({
              name,
              value,
          })
      );
    const hourlyDistribution =
      Array.from({ length: 24 }, (_, hour) => ({
          hour: `${hour}:00`,
          reservations:
              hourCounter[hour] ?? 0,
      }));
    setStats({
        reservations: reservations.length,
        completionRate,
        bookedHours,
        averageDuration,
        mostPopularCategory,
        noShowRate,
        peakHour,
         statusDistribution: {
            Reserved: reserved,
            CheckedIn: checkedIn,
            CheckedOut: checkedOut,
            Cancelled: cancelled,
            NoShow: noShows,
        },
        categoryDistribution,
        hourlyDistribution,
    });
  }
    useEffect(() => {
    if (app.operatorId && app.categoryNames?.length) {
      loadStatistics();
    }
  }, [app.operatorId, app.categoryNames]);
return (

<div className="statistics-dashboard">
    <div className="kpi-grid">
        <Card>
            <CardHeader>
                <strong>Total Reservations</strong>
            </CardHeader>
            <CardContent>
                <h2>{stats.reservations}</h2>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <strong>Booked Hours</strong>
            </CardHeader>
            <CardContent>
                <h2>{stats.bookedHours}</h2>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <strong>Average Duration</strong>
            </CardHeader>
            <CardContent>
                <h2>{stats.averageDuration.toFixed(1)} h</h2>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <strong>Most Popular Category</strong>
            </CardHeader>
            <CardContent>
                <h2>{stats.mostPopularCategory}</h2>
            </CardContent>
        </Card>
    </div>

    <Card>
        <CardHeader>
            <CardTitle>
                Peak Usage Throughout the Day
            </CardTitle>
        </CardHeader>
        <CardContent>
            <PeakUsageChart
                data={stats.hourlyDistribution}
            />
        </CardContent>
    </Card>

    <div className="chart-grid">
        <Card>
            <CardHeader>
                <CardTitle>
                    Reservation Status
                </CardTitle>
            </CardHeader>
            <CardContent>
                <StatusPieChart
                    data={stats.statusDistribution}
                />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>
                    Category Usage
                </CardTitle>
            </CardHeader>
            <CardContent>
                <CategoryPieChart
                    data={stats.categoryDistribution}
                />
            </CardContent>
        </Card>
    </div>

    <div className="chart-grid">
        <Card>
            <CardHeader>
                <CardTitle>
                    Completion Rate
                </CardTitle>
            </CardHeader>
            <CardContent>
                <CompletionChart
                    value={stats.completionRate}
                />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>
                    No Show Rate
                </CardTitle>
            </CardHeader>
            <CardContent>
                <NoShowChart
                    value={stats.noShowRate}
                />
            </CardContent>
        </Card>
    </div>
</div>
);
}