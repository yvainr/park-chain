import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts";

type Props = {
    data: {
        hour: string;
        reservations: number;
    }[];
};

export function PeakUsageChart({ data }: Props) {
    return (
        <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="hour"
                    interval={1}
                />
                <YAxis allowDecimals={false} />

                <Tooltip />
                <Line
                    type="monotone"
                    dataKey="reservations"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}