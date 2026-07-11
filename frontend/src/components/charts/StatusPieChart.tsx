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
    "#3b82f6", // Reserved
    "#22c55e", // Checked In
    "#06b6d4", // Checked Out
    "#f59e0b", // Cancelled
    "#ef4444", // No Show
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