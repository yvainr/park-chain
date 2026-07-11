import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
} from "recharts";

type Props = {
    data: {
        Reserved: number;
        CheckedIn: number;
        CheckedOut: number;
        Cancelled: number;
        NoShow: number;
    };
};

const COLORS = [
    "#10263B", // Reserved
    "#C5D6E5", // Checked In
    "#005A8C", // Checked Out
    "#8C4F00", // Cancelled
    "#f59e0b", // No Show
];

export function StatusPieChart({ data }: Props) {
    const chartData = [
        {
            name: "Reserved",
            value: data.Reserved,
        },
        {
            name: "Checked In",
            value: data.CheckedIn,
        },
        {
            name: "Checked Out",
            value: data.CheckedOut,
        },
        {
            name: "Cancelled",
            value: data.Cancelled,
        },
        {
            name: "No Show",
            value: data.NoShow,
        },
    ].filter(item => item.value > 0);
    return (
        <ResponsiveContainer
            width="100%"
            height={320}
        >
            <PieChart>
                <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    label
                >
                    {chartData.map((_, index) => (
                        <Cell
                            key={index}
                            fill={COLORS[index]}
                        />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}