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
        name: string;
        value: number;
    }[];
};

const COLORS = [
    "#2563eb",
    "#22c55e",
    "#f59e0b",
    "#ec4899",
    "#8b5cf6",
    "#06b6d4",
    "#ef4444",
];

export function CategoryPieChart({ data }: Props) {

    return (

        <ResponsiveContainer
            width="100%"
            height={320}
        >

            <PieChart>

                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    label
                >

                    {data.map((_, index) => (

                        <Cell
                            key={index}
                            fill={COLORS[index % COLORS.length]}
                        />

                    ))}

                </Pie>

                <Tooltip />

                <Legend />

            </PieChart>

        </ResponsiveContainer>

    );

}