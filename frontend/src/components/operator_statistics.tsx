import { useEffect, useState } from "react";
import { parkingLedgerAbi } from "../abi/contracts";
import { readContract, toUint } from "../lib/wallet";

type Statistics = {
    reservations: number;
    completionRate: number;
    bookedHours: number;
    averageDuration: number;
    mostPopularCategory: string;
    noShowRate: number;
    peakHour: string;
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
      const startHour =
        new Date(Number(reservation.startTime) * 1000).getHours();
      hourCounter[startHour] =
        (hourCounter[startHour] ?? 0) + 1;
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
    const statusDistribution = {
        Reserved: reserved,
        CheckedIn: checkedIn,
        CheckedOut: checkedOut,
        Cancelled: cancelled,
        NoShow: noShows,
    };
    setStats({
        reservations: reservations.length,
        completionRate: completionRate,
        bookedHours,
        averageDuration,
        mostPopularCategory,
        noShowRate,
        peakHour,
        statusDistribution,
    });
  }
    useEffect(() => {
    if (app.operatorId && app.categoryNames?.length) {
      loadStatistics();
    }
  }, [app.operatorId, app.categoryNames]);
  return (
    <div className="statistics-grid">

      <div className="stat-card">
        <h4>Total Reservations</h4>
        <p>{stats.reservations}</p>
      </div>

      <div className="stat-card">
        <h4>Completed Reservations</h4>
        <p>{stats.completionRate}%</p>
      </div>

      <div className="stat-card">
        <h4>Booked Hours</h4>
        <p>{stats.bookedHours}</p>
      </div>

      <div className="stat-card">
        <h4>Average Duration</h4>
        <p>{stats.averageDuration.toFixed(1)} h</p>
      </div>

      <div className="stat-card">
        <h4>Most Popular Category</h4>
        <p>{stats.mostPopularCategory}</p>
      </div>

      <div className="stat-card">
        <h4>No-Show Rate</h4>
        <p>{stats.noShowRate}%</p>
      </div>

      <div className="stat-card">
        <h4>Peak Usage Time</h4>
        <p>{stats.peakHour}</p>
      </div>

      <div className="stat-card status-card">
        <h4>Status Distribution</h4>

        <table>
          <tbody>
            <tr>
              <td>Reserved</td>
              <td>{stats.statusDistribution.Reserved}</td>
            </tr>

            <tr>
              <td>Checked In</td>
              <td>{stats.statusDistribution.CheckedIn}</td>
            </tr>

            <tr>
              <td>Checked Out</td>
              <td>{stats.statusDistribution.CheckedOut}</td>
            </tr>

            <tr>
              <td>Cancelled</td>
              <td>{stats.statusDistribution.Cancelled}</td>
            </tr>

            <tr>
              <td>No Show</td>
              <td>{stats.statusDistribution.NoShow}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}