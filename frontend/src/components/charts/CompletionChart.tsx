import {
    ResponsiveContainer,
    BarChart,
    Bar,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type Props = {
    value: number;
};

export function CompletionChart({ value }: Props) {

    const data = [
        {
            name: "Completed",
            value,
        },
    ];

    return (
        <ResponsiveContainer width="100%" height={250}>

            <BarChart data={data}>

                <XAxis dataKey="name" />

                <YAxis
                    domain={[0, 100]}
                />

                <Tooltip />

                <Bar
                    dataKey="value"
                    fill="#005A8C"
                    radius={[8,8,0,0]}
                />

            </BarChart>

        </ResponsiveContainer>
    );

}